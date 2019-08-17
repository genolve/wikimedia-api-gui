# wikimedia-api-gui
==============

JavaScript API+GUI fetches images from [Wikimedia](https://commons.wikimedia.org/wiki/Main_Page) and displays them in a fully functioning GUI for drop-in use in your application. Try the  [Standalone Demo](https://www.genolve.com/js/wikimedia-api/index.htm) or the [Fully Integrated Demo- click 'Get images' then click 'Wikimedia'](https://www.genolve.com/svg/en/alldesigns.php?cardtype=quotes&subtype=popular&mediatype=picture)

#### Installation
Download the files and add in html header:

`<script type="text/javascript" src="wikimedia-api-gui.js"></script>
<link type="text/css" rel="stylesheet" href="wiki-api-gui-styles.css" />`


#### Usage
The GUI interface resides in a DIV in your application and returns the images via a callback function you specify on initialization:


	WikimediaApi =  new WikimediaApiClass(vpr,$);
	WikimediaApi.selfConstruct({initsearch:'landscape',
	    waiticon:'<span id="spinner" class="gnlv-blink">working!<span>',
	    thumbWidth:150,
	    containerDiv:'#gui-container',
	    clickHandler: myhandler
	    });

Example callback function:

```
var myhandler = function(theimg,jqdata){
    mydata = jqdata.attr('data-full');
    console.log("img data:"+mydata);
    try{
    	dataA =JSON.parse(mydata.replace(/'/g,'"'));
    } catch (e) {  
    	console.error("JSON parse error on:"+mydata);
    };
    $('#image-of-day').html('<img src="'+theimg+'" width="'+(dataA.width/4)+'" height="'+(dataA.height/4)+'"/>');

    }
```



#### Requirements

JQuery is the only requirement, any version above 2.1

#### Features
* Intelligently searches Wikimedia, falling back to opensearch if nothing is found
* Keeps a search history to quickly return to previous pages
* Based on search, displays links to related pages 
* Filters out images that are too small, too big or have a restricted copyright.



#### Contributing
We welcome any contributions and feedback! Just drop a note or as usual; fork, make your update, pull request.
