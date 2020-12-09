'use strict';

$(function () {
    var promokit = window.promokit || { sendRadarImmediately: function () {} };
    var sendToRlog = function (event, data) {
        promokit.sendRadarImmediately(event, {
            i: JSON.stringify(data),
        });
    };
    var VideoErrors = {
        1: 'ABORTED',
        2: 'NETWORK',
        3: 'DECODE',
        4: 'SRC_NOT_SUPPORTED'
    };
    var search = {};

    var objFilter = function (obj, predicate) {
        predicate = predicate || Boolean;
        return Object.keys(obj)
            .filter(function (key) {
                return predicate(obj[key])
            })
            .reduce(function (res, key) {
                res[key] = obj[key];
                return res
            }, {});
    };

    var range = function (start, stop, step) {
        if (stop == null) {
            stop = start || 0;
            start = 0;
        }
        if (!step) {
            step = stop < start ? -1 : 1;
        }

        var length = Math.max(Math.ceil((stop - start) / step), 0);
        var range = Array(length);

        for (var idx = 0; idx < length; idx++, start += step) {
            range[idx] = start;
        }

        return range;
    };

    function exitFullScreen(player) {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (player.webkitExitFullscreen) {
            player.webkitExitFullscreen();
        }
    }

    function appendParamsToUrl(addition) {
        return location.protocol + '//' + location.host +
            location.pathname + '?' + $.param($.extend({}, search, addition));
    }

    try {
        search = decodeURI(location.search.substring(1).replace(/\+/g, '%20').replace(/&amp;/g, '&'))
            .split('&')
            .reduce(function (acc, item) {
                var parts = item.split('=');

                acc[parts[0]] = parts[1];
                return acc;
            }, {});
    } catch (e) {
    }

    ;(function () {
        $.ajax({
            url: 'https://auth.mail.ru/cgi-bin/auth?mac=1',
            xhrFields: {
                withCredentials: true
            }
        }).then(function (res) {
            if (res.status === 'ok') {
                UserEmail = res.data.email;
            }
        });

    })();

    var name = search.name ? search.name.charAt(0).toUpperCase() + search.name.substr(1) : search.name;
    var newname = search.newname ? search.newname.charAt(0).toUpperCase() + search.newname.substr(1) : search.newname;
    var UserEmail = null;
    var FromSocialNetwork = search.from_sn === 'true';
    var SocialNetwork = search.sn;
    var Gender = search.g;
    var IsAdult = search.isadult;
    var Hobby = search.hobby;
    var Action = search.action;
    var Ages = range(0, 99 + 1);
    var Age = parseInt(search.age);

    function supportsNativeHls() {
        // Safari 3.0+ "[object HTMLElementConstructor]"
        var isSafari = /constructor/i.test(window.HTMLElement) || (function (p) {
            return p.toString() === "[object SafariRemoteNotification]";
        })(!window['safari'] || (typeof safari !== 'undefined' && safari.pushNotification));
        var isIE = /*@cc_on!@*/false || !!document.documentMode; // Internet Explorer 6-11
        var isEdge = !isIE && !!window.StyleMedia; // Edge 20+
        var isMobile = /iPad|iPhone|iPod|android/.test(navigator.userAgent);

        return isMobile || isEdge || isSafari;
    }

    function handlePlayClick(player, $overlay) {
        return function () {
            var cdnPath = '/video/';
            var hobby = Hobby && window.Hobbies[Hobby] ? 'h_' + Hobby : '';
            var action = Action && (window.Actions[Action] || window.ActionsAdult[Action]) ? 'a_' + Action : '';
            var age = !isNaN(Age) && Ages.indexOf(Age) !== -1 ? Age : '';
            var gender = Gender;
            var id = '_';

            if (Names.quickLookup.indexOf(name) !== -1) {
                id = Names[name].translit;
                gender = Names[name].gender || gender;
            }

            var manifestFileName = (IsAdult === '1' ? 'adult' : 'kids') + '_' + 'manifest.m3u8';
            var manifest = cdnPath +
                [gender === 'm' ? 'man' : 'girl', id, hobby, action, age].filter(
                    function (val) {
                        return !(val == null || val === '');
                    }).join('/') + '/' + manifestFileName;

            promokit.sendRadarImmediately('play-request');

            if (!player.src) {
                if (supportsNativeHls()) {
                    player.src = manifest;
                    player.play();
                } else {
                    if (Hls.isSupported()) {
                        var hls = new Hls();

                        hls.attachMedia(player);
                        hls.loadSource(manifest);

                        hls.on(Hls.Events.MANIFEST_PARSED, function () {
                            player.play();
                        });

                        hls.on(Hls.Events.ERROR, function (e, data) {
                            sendToRlog('play-error_' + data.details);
                        });
                    }
                }
            } else {
                $(player).show(0);
                supportsNativeHls() && player.load();
                player.play();
            }

            if (window.dataLayer) {
                window.dataLayer.push({
                    'event': window.location.search.indexOf('isadult=0') >= 0 ? 'video_kids' : 'video_adult'
                });
            }

            $overlay.fadeOut(500);
        }
    }

    if (FromSocialNetwork) {
        sendToRlog('from-social', {
            network: SocialNetwork
        });
    }

    var progress = {};

    var resetProgress = function () {
        progress = {
            '25': false,
            '50': false,
            '75': false
        };
    }

    resetProgress();

    var progressHandler = function (e) {
        if (!(e.target && e.target.duration && e.target.currentTime)) {
            return;
        }

        var pos = e.target.currentTime / e.target.duration;
        var steps = ['25', '50', '75'];

        for (var i = 0; i < steps.length; i++) {
            var step = steps[i];
            if (pos >= parseFloat('0.' + step) && !progress[step]) {
                progress[step] = true;
                promokit.sendRadarImmediately('play-progress-' + step);
            }
        }
    }

    if (name) { // name found, show video
        var isPlayingFromStart = false;
        var playerName = document.querySelector('.js-player-name');

        $('.js-name').text(Names[name] ? Names[name].genitive : 'вас');

        $('.js-page-video').show();
        $('.js-page-main').hide();
        $('.js-page-newname').hide();

        promokit.sendRadarImmediately('show-page-video');

        if (playerName) {
            $('.js-play-name').on('click', handlePlayClick(playerName, $('.js-player-name-overlay')));

            playerName.addEventListener('loadedmetadata', function () {
                isPlayingFromStart = true;
            });
            playerName.addEventListener('playing', function () {
                if (isPlayingFromStart) {
                    isPlayingFromStart = false;
                    promokit.sendRadarImmediately('play-started');
                }
            });
            playerName.addEventListener('progress', progressHandler);
            playerName.addEventListener('ended', function () {
                promokit.sendRadarImmediately('play-end');

                isPlayingFromStart = true;
                resetProgress();
                $('.js-player-name-overlay').fadeIn(500, function () {
                    //playerName.currentTime = 0;
                    exitFullScreen(playerName);
                    $(playerName).hide(0);
                });
            });
            playerName.addEventListener('error', function (e) {
                sendToRlog('play-error_' + VideoErrors[e.target.error], {email: UserEmail});
            });
        }

        $('.js-ny18-back').on('click', function () {
            location.href = '//' + location.host + location.pathname;
        });

    } else if (newname) { // name not found, suggest request
        var playAfterPause = false;
        var playerBase = document.querySelector('.js-player-base');

        $('.js-textfield-name').val(newname);

        $('.js-page-newname').show();
        $('.js-page-video').hide();
        $('.js-page-main').hide();
        promokit.sendRadarImmediately('show-page-newname');

        if (playerBase) {
            $('.js-play-base').on('click', handlePlayClick(playerBase, $('.js-player-base-overlay')));

            playerBase.addEventListener('pause', function () {
                playAfterPause = true;
            });
            playerBase.addEventListener('playing', function () {
                if (playAfterPause) {
                    playAfterPause = false;
                } else {
                    promokit.sendRadarImmediately('play-started');
                }
            });
            playerBase.addEventListener('progress', progressHandler);
            playerBase.addEventListener('ended', function () {
                promokit.sendRadarImmediately('play-end');
                resetProgress();

                $('.js-player-base-overlay').fadeIn(500, function () {
                    //playerBase.currentTime = 0;
                    exitFullScreen(playerBase);

                    $(playerBase).hide();
                });
            });
            playerBase.addEventListener('error', function (e) {
                sendToRlog('play-error_' + VideoErrors[e.target.error], {email: UserEmail});
            });
        }

        if ($("#js-ny18-addform").length !== 0) {
            $("#js-ny18-addform").parsley().on('field:validated', function () {
                var ok = $('.parsley-error').length === 0;
                $('.input-error').removeClass('input-error');
                if (!ok) {
                    $('.parsley-error').parent(".js-inputbox").addClass('input-error');
                }
            }).on('form:submit', function () {
                $('.js-addform').hide();
                $('.js-addformsent').show();

                sendToRlog('name-request', {
                    name: $('.js-textfield-name').val(),
                    email: $('.js-textfield-email').val(),
                    gender: Gender && Gender.toLowerCase() === 'f' ? 'female' : 'male'
                });

                return false;
            });

            $('.js-addform-submit').on('click', function () {
                $("#js-ny18-addform").trigger("submit");
            });
        }

        $('.js-ny18-back').on('click', function () {
            location.href = '//' + location.host + location.pathname;
        });
    } else { // main page
        var nameHash = Object.keys(Names).reduce(function (acc, key) {
            if (key === 'quickLookup') {
                return acc;
            }

            var variants = Names[key] ? Names[key].variants : [];

            variants.forEach(function (variant) {
                acc[variant] = key;
            });

            return acc;
        }, {});

        $('.js-page-main').show();
        $('.b-past-video-link').show();
        $('.js-page-video').hide();
        $('.js-page-newname').hide();
        promokit.sendRadarImmediately('show-page-main');

        // suggests
        $('#ny18-find-person')
            .autoComplete({
                minChars: 0,
                delay: 100,
                cache: 0,
                source: function source(term, suggest) {
                    term = term.toLowerCase().replace(/[Ёё]/gi, 'е').trim();
                    if (term.length < 3) {
                        suggest([]);
                        return;
                    }
                    var matches = {};
                    var i;

                    Object.keys(Names).forEach(function (name) {
                        if (name === 'quickLookup') {
                            return;
                        }

                        Names[name].variants.forEach(function (variant) {
                            if (variant === term) {
                                matches[name] = 1;
                            } else if (variant.indexOf(term) === 0) {
                                matches[name] = 2;
                            } else if (variant.indexOf(term) !== -1) {
                                matches[name] = 3;
                            }
                        });
                    });

                    var result = Object.keys(matches).sort(function (a, b) {
                        if (matches[a] === matches[b]) {
                            return 0;
                        } else if (matches[a] < matches[b]) {
                            return -1;
                        } else {
                            return 1;
                        }
                    });

                    suggest(result);
                },
            })
            .on('keydown', function (e) {
                if (e.keyCode !== 13) {
                    return;
                }
                if ($('.autocomplete-suggestions').css('display') !== 'block') {
                    $('.js-namesend').click();
                }

                // Если открыты саджесты, но они не выбраны через клавиши вверх/вниз,
                // то всё равно сабмитим форму
                var suggestions = $('.autocomplete-suggestion.selected');
                if (suggestions.length === 0) {
                    $('.js-namesend').click();
                }
            });

        $('#ny19-age')
            .attr({min: Ages[0], max: Ages[Ages.length - 1]})
            .on('input', function () {
                var value = parseInt(this.value);
                $(this).val(isNaN(value) || Ages.indexOf(value) === -1 ? '' : value);
            });

        $('.js-form-field').on('focus', function () {
            resetFieldError(this);
        });

        // forms
        $('.js-namesend').on('click', function () {
            $('.autocomplete-suggestions').hide();

            var name = $('#ny18-find-person').val().trim(),
                hobby = $('#ny19-hobby').val(),
                action = $('#ny20-action').val(),
                age = $('#ny19-age').val(),
                isadult = $('#is-adult').val(),
                error = false;

            $('.js-form-field').each(function () {
                var field = $(this);
                if (field.prop('required') && !field.val().trim()) {
                    error = true;
                    field.closest('.js-form-row').addClass('is-error');
                }
            });

            if (error) {
                return;
            }

            name = name.replace(/[Ёё]/gi, 'е');
            name = name.charAt(0).toUpperCase() + name.substr(1).toLowerCase();

            var fullName = Names.quickLookup.filter(function (_name) {
                return _name.toLowerCase().replace('ё', 'е') === name.toLowerCase();
            });

            if (!fullName.length && name.toLowerCase() in nameHash) {
                name = nameHash[name.toLowerCase()];
            } else if (fullName.length) {
                name = fullName[0];
            }

            var isNotFound = Object.keys(Names).indexOf(name) === -1;

            sendToRlog('name-submit', {
                name: name,
                email: UserEmail,
                isNotFound: isNotFound,
                hobby: hobby,
                action: action,
                age: age
            });

            if (isNotFound) {
                var $popup = $('.js-popup-sselect');
                bodyScrollLock.disableBodyScroll($popup[0], {
                    reserveScrollBarGap: true,
                    onOverflowHide: function () {
                        $popup.show();
                    },
                });
            } else {
                location.href = '//' + location.host + location.pathname + '?' +
                    $.param(objFilter({name: name, hobby: hobby, action: action, age: age, isadult: isadult}));
            }
        });
    }

    // popups
    $('.js-popup-close').on('click', function () {
        $('.js-popup').hide();
        bodyScrollLock.clearAllBodyScrollLocks();
    });
    $('.js-sselect-submit').on('click', function (e) {
        var name = $('#ny18-find-person').val(),
            hobby = $('#ny19-hobby').val(),
            action = $('#ny20-action').val(),
            isadult = $('#is-adult').val(),
            age = $('#ny19-age').val();

        name = name.charAt(0).toUpperCase() + name.substr(1);

        var gender = $(e.target).data('gender');

        location.href = '//' + location.host + location.pathname + '?' +
            $.param(objFilter({newname: name, hobby: hobby, action: action, age: age, g: gender, isadult: isadult}));
    });

    var Share = {
        meta: {
            title: $('meta[property="og:title"]').attr('content'),
            text: $('meta[property="og:description"]').attr('content'),
            img: $('meta[property="og:image"]').attr('content'),
        },
        vk: function () {
            var url  = 'https://vk.com/share.php?';
            url += 'url='           + encodeURIComponent(appendParamsToUrl({from_sn: true, sn: 'vk'}));
            url += '&title='        + encodeURIComponent(this.meta.title);
            url += '&description='  + encodeURIComponent(this.meta.text);
            url += '&image='        + encodeURIComponent(this.meta.img);
            url += '&noparse=true';
            this.popup(url);
        },
        ok: function () {
            var url  = 'https://connect.ok.ru/offer?';
            url += 'url='           + encodeURIComponent(appendParamsToUrl({from_sn: true, sn: 'ok'}));
            url += '&title='        + encodeURIComponent(this.meta.title);
            url += '&imageUrl='     + encodeURIComponent(this.meta.img);
            this.popup(url);
        },
        fb: function () {
            var url  = 'https://www.facebook.com/sharer.php?src=sp';
            url += '&u='            + encodeURIComponent(appendParamsToUrl({from_sn: true, sn: 'fb'}));
            url += '&title='        + encodeURIComponent(this.meta.title);
            url += '&description='  + encodeURIComponent(this.meta.text);
            url += '&picture='      + encodeURIComponent(this.meta.img);
            this.popup(url);
        },
        tw: function () {
            var url  = 'https://twitter.com/intent/tweet?';
            url += 'text='          + encodeURIComponent(this.meta.text);
            url += '&url='          + encodeURIComponent(appendParamsToUrl({from_sn: true, sn: 'tw'}));
            this.popup(url);
        },

        popup: function (url) {
            window.open(url,'','resizable=1, scrollbars=1, titlebar=1, width=800, height=900, top=10, left=10');
        }
    };

    $('.js-share-vk').on('click', function () {
        Share.vk();
    });
    $('.js-share-ok').on('click', function () {
        Share.ok();
    });
    $('.js-share-tw').on('click', function () {
        Share.tw();
    });
    $('.js-share-fb').on('click', function () {
        Share.fb();
    });

    $('.js-share-link').on('click', function (e) {
        var $this = $(this);
        e.preventDefault();
        $this.removeClass("js-share-link_copied");
        $this.removeClass("js-share-link_press");
    });

    var copy = new Clipboard('.js-share-link', {
        text: function () {
            return appendParamsToUrl({from_sn: true, sn: 'link'});
        }
    });

    copy.on('success', function (e) {
        $('.js-share-link').addClass("js-share-link_copied");

        e.clearSelection();
    });

    copy.on('error', function (e) {
        $('.js-share-link').addClass("js-share-link_press");
    });

    window.Hobbies && $('#ny19-hobby').each(function () {
        $(this).append($.map(window.Hobbies, function (text, val) {
            return $("<option></option>").attr('value', val).text(text);
        }));
    });

    function appendOptions(arr) {
        arr && $('#ny20-action').each(function () {
            $(this).append($.map(arr, function (text, val) {
                return $('<option></option>').attr('value', val).text(text);
            }));
        });


        $('.js-select').each(function () {

            var $this = $(this),
                $select = $('select', $this),
                $dropdown = $('.select-dropdown', $this),
                $checked = $('.select-checked', $this),
                optionClass = 'select-option',
                $options = $select.find('option').filter(function () {
                    return !!this.value;
                }).map(function () {
                    return $('<div></div>')
                        .addClass(optionClass)
                        .text($(this).text())
                        .data('val', $(this).attr('value'));
                }).get();

            $dropdown.append($options);

            $checked.click(function (e) {
                e.stopPropagation();
                if ($dropdown.is(":visible")) {
                    $dropdown.hide();
                } else {
                    $('.select-dropdown').hide();
                    $dropdown.show();
                }
                resetFieldError(this);
            });

            $this.on('click', '.' + optionClass, function (e) {
                e.stopPropagation();
                $dropdown.hide();
                $checked.text($(this).text())
                $select.val($(this).data('val'));
            });
        });
    }

    $(document).on('click', closeDropdown);

    function closeDropdown (e) {
        if (!$(e.target).closest('.js-select').length) {
            $('.select-dropdown').hide();
        }
    }

    function resetFieldError ($el) {
        $($el).closest('.js-form-row').removeClass('is-error');
    }

    new Rellax('.js-rellax');


    $('.js-intro .button').on('click', function () {
        $('.js-intro').hide();
        $('.js-form').show();
        if (this.name == 'kid') {
            $(".b-form__info_adult").hide();
            $(".b-form__info_kid").show();
            $('.b-form__row_hobby').show().find('select').attr('required');
            $('#is-adult').val('0')
            appendOptions(window.Actions);
        } else if (this.name == 'adult') {
            $(".b-form__info_adult").show();
            $(".b-form__info_kid").hide();
            $('.b-form__row_hobby').hide().find('select').removeAttr('required');
            $('#is-adult').val('1')
            appendOptions(window.ActionsAdult);
        }

    })


});