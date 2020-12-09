document.addEventListener('DOMContentLoaded', function(){ 

    let proxy1 = 'https://api.allorigins.win/raw?url=';
    let proxy2 = 'https://thingproxy.freeboard.io/fetch/';

    let mass = window.location.search.slice(1).split('&');
    let name = mass[0];
    let age = mass[1];

    if(Hls.isSupported()) {
        var video = document.getElementById('video');
        var hls = new Hls();
        hls.loadSource(
            'https://thingproxy.freeboard.io/fetch/'
            + 'https://newyear.mail.ru/video/man/'
            + name
            + '/h_telefon/a_roditeli/12/kids_manifest.m3u8'
            );
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED,function()
        {
            video.play();
        });
    }

});