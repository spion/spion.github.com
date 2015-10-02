---
layout: post
title: Let it snow
date: 2012-08-10
---

I thought I'd post my javascript snow one-liner. Note that it doesn't work in firefox due to the new protection mechanisms. In Chrome it does, however you will need to type in the "javascript:" part manually because it automatically strips it off from the pasted text


1.  Open a website

2.  Delete the address from the address bar, replace it with "javascript:" (without the quotes)

3.  Add this and press enter:

```
(function(){for(var c=[],d=Math.random,f=document.body.clientWidth-32,b=0;50>b;
++b){c.push({c:document.createElement("div"),g:{b:0,a:d()*f,f:2,e:2,d:1}});
c[b].c.innerHTML="*";var e=c[b].c.style;e.position="absolute";e["font-size"]=
12+12*d()+"px";e.color="rgba(255,255,255,0.75)";e["text-shadow"]="0px 0px 5px #aaa";
e.zIndex=65535;document.body.appendChild(c[b].c)}setInterval(function(){for(var a,
b=0;b<c.length;++b)a=c[b].g,a.d=0.1>d()?!a.d:a.d,a.e=0+(1+2*d())*(a.d?1:-1),a.f=
1+2*d(),a.b+=a.f,a.a+=a.e,512<a.b&&(a.b=0),a.a>f-32&&(a.a=0),0>a.a&&(a.a=f-32),
c[b].c.style.top=a.b+"px",c[b].c.style.left=a.a+"px"},33)})();`
```

<object width="640" height="360" class="BLOGGER-youtube-video" classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" codebase="http://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=6,0,40,0" data-thumbnail-src="http://1.gvt0.com/vi/mN7LW0Y00kE/0.jpg"><param name="movie" value="http://www.youtube.com/v/mN7LW0Y00kE&fs=1&source=uds" /><param name="bgcolor" value="#FFFFFF" /><param name="allowFullScreen" value="true" /><embed width="640" height="360"  src="http://www.youtube.com/v/mN7LW0Y00kE&fs=1&source=uds" type="application/x-shockwave-flash" allowfullscreen="true"></embed></object>

:)