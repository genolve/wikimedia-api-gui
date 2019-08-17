/*
CLASS: WikimediaApi  utility functions to query wikimedia images

 ==ClosureCompiler==
 @compilation_level SIMPLE_OPTIMIZATIONS
 @output_file_name wikimedia-api-gui.js
 ==/ClosureCompiler==

selfConstruct  - setup div framework, input textbox  (inside containerDiv) and optionally load an initial query
openAuxSearch  - Search using opensearch api.  Returns an array of search results.
openSearch     - Search using opensearch api.  Returns an array of search results.        
findRedirect   - get redirect by parsing links for given pageid/titles 
findCatId      - given a category search term, find the Id and forward to getQuality
listCategories - list Category, with a GENERATOR, for specified word.
mkPageLinks    - make page/category/file links
moreLike       - Search using moreLike api. 
queryTitles    - Query based on "titles" parameter and return page id.
getThumbsForPage - Get the thumbnail (and full image URL) for ARRAY of PAGES
fastcciCallback - callback: get quality images for given category
getQuality     - get quality images for given category
getThumbsOneShot - Get thumbs and full image url in one query
mkThumb        - make a thumbnail for given image(s)
capitalizeString - Capitalize the first letter of each word
catagorizeString - Capitalize the first letter of each word
clearDivs      - clear out divs show wait icon and handle history stack         
goBackl        - pop history stacks and load to appropriate divs
getLastSearch  - get last item on history stack                              
*/
WikimediaApiClass = function(vpr,$) {

  var wqa = this;
  var API_URL = "https://commons.wikimedia.org/w/api.php";
  var API_NAME = "WikimediaApi";
  var historyA = [];
  var historytA = [];  
  var historyiA = [];
  var dontclearcats=0;
  var qualityDown=false;
  var prevsearch="Search for quotes";
	// GLOBAL HELPER OBJ 
	if(vpr==null)vpr={};
	var vpradd={name:'minivpr',
			noop:function(){ // do nothing function
								},
			// DEBUG
			vprint:function(tag,stuff){
				console.log(tag+stuff);// comment out for production!
				} ,
			// DEBUG
			dumpvar:function(inval){return JSON.stringify(inval)},
			// UTIL
			iterate:function(obj){$.map(obj, function(element,index) {return index});},
			size: function(obj){
				return (typeof obj=='array')?(obj.length):-1;},
			dd: function (num){
				return (Math.round(parseFloat(num)*100)/100);
				},
			// UTIL
			isnull:		function(v){
				if(typeof v=='undefined')
					return true;
				v=String(v);
				if(v==="0")
					return false;
				else
					return (v=="" || v=="undefined" || v=="_All_" || v=="null" || v===null)?true:false;
				},
			//UTIL
			checkEnter : function(e){ //e is event object passed from function invocation
				var characterCode,ret_val;
				if(e && e.which){ //if which property of event object is supported (NN4)
					 e = e;
					 characterCode = e.which; //character code is contained in NN4's which property
					 }
				else{							
					 e = e;					
					 characterCode = e.keyCode; //character code is contained in IE's keyCode property
					 }
				ret_val = (characterCode == 13)?true:false;
				if(ret_val){ // stop any default actions
					e.cancelBubble = true;
					e.returnValue = false;
					document.activeElement.blur();//20161004 close ipad virtual keyboard
					if (e.stopPropagation) {
						e.stopPropagation();
						e.preventDefault();
						}
					}
				return (ret_val); 
				},
				getQueryDomain : function(theurl) {
					thewebname=window.location.hostname;
					if(thewebname==null)
						theurl=String(window.location);
					var ret=String(((theurl==null)?thewebname:theurl.replace(/^https?\:\/\/w*\.?/i,"").replace(/\/.*/,"") ));
					return ret;
					},
			// CALBACK
			wkUsePic: function(jqel) {
				var picid = jqel.attr('data-url');//jqel.get(0)['data-url'];
				var ww = jqel.prop('width');
				var hh = jqel.prop('height');
				var aa = ww/hh;
				var change2meet=false;
				if(aa >1.3 || aa < .75)
					change2meet=true;
				//  key:image selected:https://upload.wikimedia.org/wikipedia/commons/3/3b/BrockenSnowedTreesInSun.jpg w,h,a:150,99,1.5151515151515151 slotNqueryOld:wkdiv
				vpr.vprint("wiki","= = = = = = = wkUsePic selected:"+picid+" w,h,a:"+ww+","+hh+","+aa);
				wqa.clickHandler(picid,jqel);
				}
			};
	for(key in vpradd)
		if(vpr[key]==null)
			vpr[key] = vpradd[key];
	vpr.vprint("wiki","Have vpr?"+vpr.name);
		
   /**
   selfConstruct - setup div framework, input textbox  (inside containerDiv) and optionally load an initial query
   example options:
   {initsearch:'landscape',
										waiticon:'<span id="spinner" class="gnlv-blink">working!<span>',
										thumbWidth:150,
										containerDiv:'#gui-container',
										clickHandler: myhandler
										}
   */
  wqa.selfConstruct = function(optionsO) {
    if(optionsO.containerDiv==null)
      vpr.vprint("wiki","selfConstruct start, have NO containerDiv!");
		else if(typeof(optionsO.containerDiv=="String")){
			wqa.containerDiv=$(optionsO.containerDiv);
      vpr.vprint("wiki","selfConstruct found containerDiv?"+wqa.containerDiv.length);
			}
    else
      wqa.containerDiv=optionsO.containerDiv;
    vpr.vprint("wiki","selfConstruct start, have containerDiv:"+wqa.containerDiv.prop('id'));
    // PARAMS
    wqa.waiticon   = optionsO.waiticon;
		wqa.mshrink    = optionsO.mshrink || 1;
		wqa.clickHandler = optionsO.clickHandler;         
    wqa.thumbWidth = (optionsO.thumbWidth==null)?200:optionsO.thumbWidth;
    initsearch     = (optionsO.initsearch==null)?'':optionsO.initsearch;
    // DIVS/SEARCH BOX/BACK
    wqa.containerDiv.append('Search '+API_NAME.replace(/api/i,"")+': <input id="'+API_NAME+'input" type="text" width="40" value="'+initsearch+'" style="margin:5px;" /><a id="'+API_NAME+'goback" class="gnlv-gone gnlv-a" href="javascript:vpr.noop()" onClick="'+API_NAME+'.goBackl()"><< BACK</a>');
    $('#'+API_NAME+'input').on('keyup', function(event){
                  var theid = this.id;
                  var thisguy = this.value;
                  newtext = wqa.capitalizeString(thisguy);
                  vpr.vprint("wiki","event:keyup on:"+theid+" "+thisguy+" -> "+newtext);
                  if(vpr.checkEnter(event) ){
                    wqa.queryTitles(newtext,{clear:true,setPrevSearch:true});
                  }
                });
    wqa.linksDiv   = $('<div id="wikilinksdiv" class="leftit" ></div>');
    wqa.containerDiv.append(wqa.linksDiv);
    wqa.thumbsDiv  = $('<div id="wikithumbsdiv" class="leftit" ></div>');
    wqa.containerDiv.append(wqa.thumbsDiv);
    wqa.inputEl = $('#'+API_NAME+'input');
    //INIT SEARCH
    if(initsearch!=''){
      prevsearch=initsearch;
      wqa.getThumbsOneShot(-1,wqa.capitalizeString(initsearch),{clear:true,isInitSearch:true});
      }

  } // end selfConstruct
 /**
   openAuxSearch - Search using opensearch api.  Returns an array of search results.
   
   20170404 big problem opensearch can return empty catagories and no way to detect it WHICH IS SHIT so change the name
   
example call:
   https://commons.wikimedia.org/w/api.php?action=opensearch&format=json&search=Category:Pawprints&suggest=1&redirect=1&prop=categoryinfo
response:
   ["Category:Paw",["Category:Pawnee County, Kansas","Category
:Pawnee County, Nebraska","Category:Pawnee County, Oklahoma","Category:Paw\u0142owice","Category:Pawn
 shops","Category:Pawe\u0142 M\u0105ciwoda","Category:Pawe\u0142 Stalmach","Category:Pawtucket, Rhode
 Island","Category:Pawsonaster","Category:Pawe\u0142 Sapieha (1860-1934)"],["","","","","Voir aussi 
 les cat\u00e9gories\u202f: Arts and crafts shops, Antique shops, Pawnbrokers, Second-hand markets, Outlet
 stores, Recycle Shops et Junk shops.","","","","Included species (for WoRMS,  18 December 2014):",""
],["https://commons.wikimedia.org/wiki/Category:Pawnee_County,_Kansas","https://commons.wikimedia.org
/wiki/Category:Pawnee_County,_Nebraska","https://commons.wikimedia.org/wiki/Category:Pawnee_County,_Oklahoma"
,"https://commons.wikimedia.org/wiki/Category:Paw%C5%82owice","https://commons.wikimedia.org/wiki/Category
:Pawn_shops","https://commons.wikimedia.org/wiki/Category:Pawe%C5%82_M%C4%85ciwoda","https://commons
.wikimedia.org/wiki/Category:Pawe%C5%82_Stalmach","https://commons.wikimedia.org/wiki/Category:Pawtucket
,_Rhode_Island","https://commons.wikimedia.org/wiki/Category:Pawsonaster","https://commons.wikimedia
.org/wiki/Category:Pawe%C5%82_Sapieha_(1860-1934)"]]

ref 
https://www.mediawiki.org/wiki/API:Opensearch
   */
  wqa.openAuxSearch = function(pageId, titles,  optionsO) {
    linksDiv=(optionsO && optionsO.linksDiv)?optionsO.linksDiv:wqa.linksDiv;
    $.ajax({
      url: API_URL,
      dataType: "jsonp",
      data: {
        format: "json",
        action: "opensearch",
        namespace: 14|0|6, // 0 page 6 file default 14 is cats -1 special -2 media
        suggest: "",
        limit:"50",
        profile:"fuzzy",
        redirects:"resolve",
        search: titles
      },

      success: function(result, status){
        vpr.vprint("wiki","openSSearch found:"+vpr.dumpvar(result));
        pageA=result[1]; // a list of categories
        catA=[];
        pagA=[];
        for(ii=0; ii< pageA.length; ii++){
            var infoA = pageA[ii];
            vpr.vprint("wiki","openSSearch CALBACK page["+ii+"] GOT:"+infoA);
            if(infoA.match(/^Category:/i))
              catA.push(infoA);
            else
              pagA.push(infoA);              

            } //end for
        vpr.vprint("wiki","openSSearch CALBACK DONE num cats:"+catA.length+" pages:"+pagA.length);
        if(catA.length>=1)
          wqa.mkPageLinks(catA,{isCat:true});
        if(pagA.length>=1)
          wqa.mkPageLinks(pagA);
        if(catA.length==0 && pagA.length==0)
          wqa.thumbsDiv.html('<h2>Nothing Found, check spelling or try a category!</h2>');
      },
      error: function(xhr, result, status){
        vpr.vprint("wiki","openSSearch Error for " +status+","+result+","+vpr.dumpvar(xhr));
      }
    });
  }; // end openAuxSearch
  
 /**
   openSearch - Search using search api.  Returns an array of search results
   
example call:
   https://commons.wikimedia.org/w/api.php?format=json&action=query&list=search&prop=categoryinfo&srlimit=50&srsearch=Category:Spongebob|Spongebob&redirects=resolve
response:
 {"batchcomplete":"","query":{"searchinfo":{"totalhits":23},"search":[{"ns":14,"title":"Category:SpongeBob SquarePants","size":3118,"wordcount":136,"snippet":"English: SpongeBob SquarePants \u0627\u0644\u0639\u0631\u0628\u064a\u0629: \u0633\u0628\u0648\u0646\u062c\u0628\u0648\u0628 \u0645\u0635\u0631\u0649: \u0633\u0628\u0648\u0646\u062c \u0628\u0648\u0628 \u0633\u0643\u0648\u064a\u0631 \u0628\u0627\u0646\u062a\u0632 Catal\u00e0: Bob Esponja \u010ce\u0161tina: Spongebob v kalhot\u00e1ch Cymraeg: SpynjBob Pantsgw\u00e2r","timestamp":"2016-07-14T08:11:39Z"},{"ns":14,"title":"Category:Spongebob Squarepants","size":43,"wordcount":0,"snippet":"","timestamp":"2015-04-27T08:45:34Z"}

ref 
https://www.mediawiki.org/wiki/API:Search
   */
  wqa.openSearch = function(pageId, titles,  optionsO) {
    linksDiv=(optionsO && optionsO.linksDiv)?optionsO.linksDiv:wqa.linksDiv;
    vpr.vprint("wiki","openSearch  = = START = = pageId:"+pageId+" titles:"+titles);
    $.ajax({
      url: API_URL,
      dataType: "jsonp",
      data: {
        format: "json",
        action: "query",
        list: "search",
        srnamespace:"0|6|14",
        prop: "categoryinfo",
        srprop:"size|wordcount|redirecttitle|snippet",
        srlimit:"90",
        redirects:"resolve",
        srsearch: titles
      },

      success: function(result, status){
        vpr.vprint("wiki","openSearch CALLBACK pageId:"+pageId+" titles:"+titles+" found:"+vpr.dumpvar(result));
        if(result.query==null || result.query.search==null)
          wqa.thumbsDiv.html('<h2>Nothing Found, check spelling or try a category!</h2>')
        else {
          pageA=result.query.search; // a list of categories
          curtitleRE= new RegExp(titles,"i");
          catA=[];
          jpgA=[];
          pagA=[];
          for(ii=0; ii< pageA.length; ii++){
              var infoA = pageA[ii];
              if((infoA.snippet==""&&infoA.size==0) || infoA.snippet.match(/This category should be empty/))
                vpr.vprint("wiki","openSearch CALBACK SKIP bad page["+ii+"] GOT:"+vpr.dumpvar(infoA));
              else if(optionsO && optionsO.feelinglucky && infoA.title.match(curtitleRE) && infoA.ns==0){
                vpr.vprint("wiki","openSearch CALBACK have a * * * LUCKY MATCH * * * on page["+ii+"] GOT:"+vpr.dumpvar(infoA));
                wqa.getSectionsForPage(null,infoA.title,{clear:false});
                return;
                }
              else if(infoA.title.match(/^Category:/i))
                catA.push(infoA.title);
              else if(infoA.title.match(/^File/i)){
                if(infoA.title.match(/(jpg|jpeg|png|gif)$/i))
                  jpgA.push(infoA);
              }
              else
                pagA.push(infoA.title);              
              } //end for
          vpr.vprint("wiki","openSearch CALBACK DONE num cats:"+catA.length+" pages:"+pagA.length+" jpgs:"+jpgA.length);
          if(catA.length>=1)
            wqa.mkPageLinks(catA,{isCat:true});
          if(pagA.length>=1)
            wqa.mkPageLinks(pagA);
          if(jpgA.length>=1)
            wqa.getThumbsForPage(null,jpgA);
          if(catA.length<=2 && pagA.length<=2 && pagA.length<=2){
            wqa.openAuxSearch(null,titles);
            dontclearcats=1;
            //wqa.thumbsDiv.html('<h2>Nothing Found, check spelling or try a category!</h2>');
            }
          }
        },
      error: function(xhr, result, status){
        vpr.vprint("wiki","openSearch Error for "+status+","+result+","+vpr.dumpvar(xhr));
      }
    });
  }; // end opensearch

/** 
  findRedirect - get redirect by parsing links for given pageid/titles
  
  call:
  https://commons.wikimedia.org/w/api.php/?format=json&action=parse&pageid=2178631&prop=links
  
  return:
  {"parse":{"title":"Category:Ocean","pageid":2178631,"links":[{"ns":10,"exists":"","*":"Template:Category redirect/en"},{"ns":10,"exists":"","*":"Template:Bad name"},{"ns":14,"exists":"","*":"Category:Oceans"}]}}
  
  ref:
  https://www.mediawiki.org/wiki/API:Parsing_wikitext
  */
  wqa.findRedirect = function(pageId, titles, optionsO) {
    linksDiv=(optionsO && optionsO.linksDiv)?optionsO.linksDiv:wqa.linksDiv;
    var mydata={
        format: "json",
        action: "parse",
        prop: "links",
        page: titles
      };
    if(pageId!=null){// swap titles for pageids
      vpr.vprint("wiki","findRedirect = =  PAGEID MODE:"+pageId);
      mydata['pageid']=pageId;
      delete mydata['page'];
      }
    vpr.vprint("wiki","findRedirect  == START ==  pageId:"+pageId+" title:"+titles);
    $.ajax({
      url: API_URL,
      dataType: "jsonp",
      cache: true,
      data: mydata,

      success: function(result, status){
        vpr.vprint("wiki","findRedirect CALLBACK START");
        var catA=[];
        var pagA=[];
        if(result.parse==null || result.parse.links==null){
          vpr.vprint("wiki","findRedirect CALLBACK NOTHING FOUND, for category["+titles+"]:"+vpr.dumpvar(result));
          wqa.openSearch(null,titles);
          }
        else{
          var linkA = result.parse.links;
          vpr.vprint("wiki","findRedirect CALLBACK GOT num links:"+linkA.length);
            for(ii=0; ii<linkA.length; ii++){
              var infoA = linkA[ii];
              vpr.vprint("wiki","findRedirect CALBACK link["+ii+"] GOT:"+vpr.dumpvar(infoA));
              if(infoA["*"].match(/^Category:/i))
                catA.push(infoA["*"] );
              else
                pagA.push(infoA["*"] );
              } //end initial pageA
            vpr.vprint("wiki","findRedirect["+titles+"] DONE num cats:"+catA.length+":");
            if(catA.length>=1) 
              wqa.listCategories(-1,catA[0]);
            else if(pagA.length>=1) 
              wqa.mkPageLinks(pagA,{divider:' | ',label:'Sub Pages:'}); 
              // list cats seems to do better!  wqa.getThumbsOneShot(pageId,catA[0]);// try thumbs oneshot on first one
          }
        }, // end success
      error: function(xhr, result, status){
        vpr.vprint("wiki","findRedirect:Error "+status+","+result+","+vpr.dumpvar(xhr));
      }
    });
  }; // end findRedirect
/** 
  findCatId - given a category search term, find the Id and forward to getQuality
  
  call:
  https://commons.wikimedia.org/w/api.php?format=json&action=query&titles=Category:Flames&redirects=resolve&prop=links|categoryinfo
  
  return: (example of a BAD redirected category that goes to Category:Flame
{"batchcomplete":"","query":{
  "pages":{"427119":{
    "pageid":427119,"ns":14,"title":"Category:Flames",
    "links":[{"ns":10,"title":"Template:Bad name"},{"ns":10,"title":"Template:Category redirect/en"},{"ns":14,"title":"Category:Flame"}],
    "categoryinfo":{"size":0,"pages":0,"files":0,"subcats":0}}}}}
    
{"batchcomplete":"","query":{
  "pages":{"1454112":{
    "pageid":1454112,"ns":14,"title":"Category:Flame",
    "categoryinfo":{"size":171,"pages":1,"files":156,"subcats":14}}}}}
  
  ref:
  https://www.mediawiki.org/wiki/API:Parsing_wikitext
  */
  wqa.findCatId = function(pageId, titles, optionsO) {
    linksDiv=(optionsO && optionsO.linksDiv)?optionsO.linksDiv:wqa.linksDiv;
    var mydata={
        format: "json",
        action: "query",
        prop: "links|categoryinfo",
        redirects:"resolve",
        titles: titles
      };
    if(pageId!=null){// swap titles for pageids
      vpr.vprint("wiki","findCatId = =  PAGEID MODE:"+pageId);
      mydata['pageid']=pageId;
      delete mydata['titles'];
      }
    vpr.vprint("wiki","findCatId  == START ==  pageId:"+pageId+" title:"+titles);
    $.ajax({
      url: API_URL,
      dataType: "jsonp",
      cache: true,
      data: mydata,

      success: function(result, status){
        var catA=[];
        vpr.vprint("wiki","findCatId CALLBACK START pageId:"+pageId+" title:"+titles);
        var catA=[];
        if(result.query==null || result.query.pages==null){
          vpr.vprint("wiki","findCatId CALLBACK NOTHING FOUND, for category["+titles+"]:"+vpr.dumpvar(result));
          //wqa.openSearch(null,titles);
          }
        else{ //---------------------------- findCatId process  ---------------------------- 
          var pageA = result.query.pages;
          for(key in pageA){
              var infoA = pageA[key];
              vpr.vprint("wiki","findCatId CALBACK page["+key+"] GOT:"+vpr.dumpvar(infoA));
              if(infoA.categoryinfo==null)
                vpr.vprint("wiki","findCatId no categoryinfo!");
              else if(infoA.categoryinfo.subcats >0 ||  infoA.categoryinfo.size >10){// ARE WE GOOD?
                vpr.vprint("wiki","findCatId LOOKS GOOD TO GO calling getQuality("+key+")");
                wqa.getQuality(key,null);
                wqa.listCategories(key,null,{isCat:true});
                }
              else if(infoA.links!=null){
                var linkA =infoA.links;
                //wqa.listCategories(-1,linkA);
                for(ii=0; ii<linkA.length;ii++)
                  if(linkA[ii].ns==14 && linkA[ii].title.match(/^Category:/i)){// take first likely candidate
                    vpr.vprint("wiki","findCatId looks promising:"+linkA[ii].title);
                    catA.push(linkA[ii]);
                    }
                }
              else {
                vpr.vprint("wiki","findCatId NO CATEGORYINFO OR LINKS for:"+titles);
                if(!titles.match(/s$/)) {// try an s
                  vpr.vprint("wiki","findCatId try again with:"+titles+"s");
                  wqa.findCatId(null,titles+"s");
                  }
                }//end nothing
              if(catA.length>0){
                // too annoying if it dont clear  dontclearcats=1;
                vpr.vprint("wiki","findCatId try again with:"+catA[0].title);
                wqa.mkPageLinks(catA,{isCat:true});
                wqa.findCatId(null,catA[0].title);
                } // 
              } //end initial page results good
            vpr.vprint("wiki","findCatId["+titles+"] DONE num cats:"+catA.length+":");
          } // end had results
        }, // end success
      error: function(xhr, result, status){
        vpr.vprint("wiki","findCatId:Error "+status+","+result+","+vpr.dumpvar(xhr));
      }
    });
  }; // end findCatId
 /**
 listCategories - list Category, with a GENERATOR, for specified word.
   call example:
https://commons.wikimedia.org/w/api.php?action=query&generator=categorymembers&prop=categoryinfo&redirects=1&gcmtitle=Category:Potatoes&gcmlimit=500

    expecting:
    "query": {
    "pages": {
        "14936551": {
            "pageid": 14936551,
            "ns": 14,
            "title": "Category:Pronunciation of words relating to potatoes",
            "categoryinfo": {
                "size": 9,
                "pages": 0,
                "files": 9,
                "subcats": 0
            }
  called by: link clicks
  thumbsOneShot pageId=-1
  findRedirect  pageId=-1
  findCatId     pageId=-1
  
  changes:
  20170412 add cats only prop
*/
  wqa.listCategories = function(pageId, titles, optionsO) {
    linksDiv=(optionsO && optionsO.linksDiv)?optionsO.linksDiv:wqa.linksDiv;
    vpr.vprint("wiki","listCategories   = =  START  = =  pageId:"+pageId+" title:"+titles);
    var mydata = {
          format: "json",
          action: "query",
          generator: "categorymembers",
          prop: "categoryinfo",
          redirects: "resolve",
          gcmlimit:"500",
          gcmtitle: titles
        };
    if(pageId!=null){// swap titles for pageids
        vpr.vprint("wiki","listCategories = =  PAGEID MODE with id:"+pageId);
        mydata['gcmpageid']=pageId;
        delete mydata['gcmtitle'];
        }
    if(optionsO && optionsO.isCat)// skip pages (already have them)
      mydata.gcmtype="subcat|page";
    if(optionsO && optionsO.clear) // do clear
        wqa.clearDivs('wait',titles,optionsO);
    
    $.ajax({
      url: API_URL,
      dataType: "jsonp",
      cache: true,
      data: mydata,

      success: function(result, status){
        vpr.vprint("wiki","listCategories CALLBACK  = =  START  = = pageId["+pageId+"]titles["+titles+"] options?"+vpr.dumpvar(optionsO));
        if(result.query==null){
          vpr.vprint("wiki","listCategories CALLBACK NOTHING FOUND, try category["+titles+"]:"+vpr.dumpvar(result));
          //wqa.mkCatLinks([titles]);
          titleA = titles.split(/\|/);
          if(titleA.length>1)
            titles=titleA[1]; //category only
          wqa.openSearch(pageId,titles);
          }
        else{
          var pageA = result.query.pages;
          var catA=[];          
          var pagA=[];
          var jpgA=[];
          var catmin=0,catmax=3;
          var filmin=0,filmax=3;
          var pagmin=0,pagmax=3;
          var sizmin=0,sizmax=3;
          var totpages = vpr.size(pageA);
          vpr.vprint("wiki","listCategories CALLBACK GOT num pages:"+totpages);
          //
          // LOOP
          for(key in pageA){
            var infoA = pageA[key];
            if(infoA.categoryinfo){
              catmin = Math.min(catmin,infoA.categoryinfo.subcats);
              catmax = Math.max(catmax,infoA.categoryinfo.subcats);
              sizmin = Math.min(sizmin,infoA.categoryinfo.size); // a combo of cats/files/pages
              sizmax = Math.max(sizmax,infoA.categoryinfo.size);
              }
            if(totpages<50)
              vpr.vprint("wiki","listCategories CALBACK page["+key+"] GOT:"+vpr.dumpvar(infoA));
            if(infoA.title.match(/^Category:/i))
              catA.push(infoA);
            else if(infoA.title.match(/^File.*(jpg|jpeg|png|gif)$/i))
              jpgA.push(infoA);
            else if(infoA.title.match(/^File/i))
              vpr.vprint("wiki","listCategories CALBACK IGNORE a non-image:"+infoA.title);
            else // a page
              pagA.push(infoA);
            } //end loop
          vpr.vprint("wiki","listCategories[pageid:"+pageId+" title:"+titles+"] DONE num cats:"+catA.length+"min/max("+catmin+","+catmax+") pages:"+pagA.length+" jpgA:"+jpgA.length);
          subcatscalerange=25/(catmax-catmin);  // fontsizekey:'subcats',fontscalerange:subcatscalerange
          generalscalerange=25/(sizmax-sizmin); // fontsizekey:'size',fontscalerange:generalscalerange
          if(catA.length==0 && pagA.length==0){// had a link click show notice of no subcats
						if(linksDiv.need2clear){
							linksDiv.need2clear=false;
							linksDiv.html('<h2>No more sub categories!</h2>');
							vpr.vprint("wiki","mkCategories LinksDiv found zip X X CLEAR WAIT");
							}
						}
          if(catA.length>=1)
            wqa.mkPageLinks(catA,{isCat:true, divider:' | ',label:'Sub Categories:',fontsizekey:'subcats',fontscalerange:subcatscalerange});
          if(pagA.length>=1) //20170409 evidence to change this to getThumbsOneshot IN pagelinks(testing with mule then click mule)
            wqa.mkPageLinks(pagA,{divider:' | ',label:'Sub Pages:'});  
          if(jpgA.length>=1)
            wqa.getThumbsForPage(null,jpgA);
          if(jpgA.length>=200 || jpgA.length<10){ // too many or too few,  list good ones
            if(jpgA.length<=0) // zip, need to clear spinner
              wqa.thumbsDiv.html('');
            vpr.vprint("wiki","listCategories to few or too many images, try getQuality");
            if(pageId!=null )
              wqa.getQuality(pageId,null);
            else if(jpgA.length>=200)
              wqa.findCatId(null,titles);//< often re-list the cats!
            else // just clear the wait
              wqa.thumbsDiv.html('<h2>Nothing Found, this category only lists other categories!</h2>');
            }
          if(titles!=null && (catA.length>=1||pagA.length>=1||jpgA.length>=1))  // found stuff try morelike
            wqa.moreLike(pageId, titles.replace(/^Category\:/,""));
          }
        }, // end success
      error: function(xhr, result, status){
        vpr.vprint("wiki","listCategories:Error "+status+","+result+","+vpr.dumpvar(xhr));
      }
    });
  }; // end listCategories
 
    
  /**
   mkPageLink - make a page/category link, this function makes DIV WRITES
      options {
     divider : [break|pipe]
     label:  "some text to start with"
   }
   expect like this: "128590":{"pageid":128590,"ns":0,"title":"Akira (film)"}
   
   called by
   */
  wqa.mkPageLinks = function(infoA,optionsO) {
    var linksDiv=(optionsO && optionsO.linksDiv)?optionsO.linksDiv:wqa.linksDiv;
    var zt; // TEXT not Object
    if(typeof infoA!="object")
      infoA = [infoA];
    vpr.vprint("wiki","mkPageLinks = = START = = "+infoA.length+" options:"+vpr.dumpvar(optionsO));
    if(linksDiv.need2clear){
      linksDiv.need2clear=false;
      linksDiv.html('');
      vpr.vprint("wiki","mkPageLinks X X CLEAR WAIT");
      }
    divider="<br>";
    if(optionsO && optionsO.divider!=null)
      divider=optionsO.divider;

    if(optionsO && optionsO.label!=null)
      linksDiv.append($("<h2>").text(optionsO.label)); //// < - - W R I T E   TO   D I V 
    //
    // LOOP  LOOP
    //
    for(ii=0;ii<infoA.length;ii++){
      if(typeof infoA[ii]!="object")
        zt=infoA[ii];
      else
        zt=infoA[ii].title;
      extrastyle="";
      if(optionsO && optionsO.fontsizekey!=null && infoA[ii].categoryinfo!=null){
        zsize = vpr.setVal(10+infoA[ii].categoryinfo[optionsO.fontsizekey]*optionsO.fontscalerange,0,10,35,vpr.setValMode.LIMIT);
        extrastyle=' style="font-size:'+zsize+'px;" ';
        }
      vpr.vprint("wiki","mkPageLinks:"+zt+" type:"+typeof(infoA[ii])+" have pageid:"+infoA[ii].pageid);
      //these will be categories
      // wqa.listCategories(pageId,"Category:"+pageO.title,thumbsDiv, error);
      if(optionsO && optionsO.isCat) //// < - - W R I T E   TO   D I V 
        linksDiv.append('<a title="'+zt+'" href="javascript:vpr.noop()" onClick="'+API_NAME+'.listCategories('+infoA[ii].pageid+',\''+(zt.replace(/ /g,"_").replace(/'/g,"\\'"))+'\',{clear:true})" class="gnlv-a" '+extrastyle+' >'+zt.replace(/^Category:/,"")+'</a>'+divider);
      else if(infoA[ii].pageid!=null)// 20170409 change to getthumbsoneshot
        linksDiv.append('<a title="'+zt+'" href="javascript:vpr.noop()" onClick="'+API_NAME+'.getThumbsOneShot('+String(infoA[ii].pageid).replace(/'/g,"")+',\''+(zt.replace(/ /g,"_").replace(/'/g,"\\'"))+'\',{clear:true})" class="gnlv-a">'+zt.replace(/^Category:/,"")+'</a>'+divider);
      else //wqa.queryTitles(newtext);
        linksDiv.append('<a title="'+zt+'" href="javascript:vpr.noop()" onClick="'+API_NAME+'.queryTitles(\''+String(zt).replace(/'/g,"\\'")+'\',{clear:true})" class="gnlv-a">'+zt.replace(/^Category:/,"")+'</a>'+divider);
      }
    } // end mkPageLinks  
    
/**
   moreLike - Search using moreLike api.  Returns an array of search results.
example call:
  https://en.wikiquote.org/w/api.php?action=query&redirects=resolve&list=search&srsearch=morelike:Xun_Zi&srlimit=10&srprop=size&formatversion=2
response:
  {
    "batchcomplete": true,
    "continue": {
        "sroffset": 10,
        "continue": "-||"
    },
    "query": {
        "searchinfo": {
            "totalhits": 5445
        },
        "search": [
            {
                "ns": 0,
                "title": "Sage (philosophy)",
                "size": 2994
            },
   
ref 
    https://www.mediawiki.org/wiki/API:Search_and_discovery
    https://www.mediawiki.org/wiki/API:Search                    for srprop
 */
  wqa.moreLike = function(pageId, titles,  optionsO) {
    linksDiv=(optionsO && optionsO.linksDiv)?optionsO.linksDiv:wqa.linksDiv;
    vpr.vprint("wiki","moreLike = =  START = = = ["+titles+"]");
    $.ajax({
      url: API_URL,
      dataType: "jsonp",
      data: {
        format: "json",
        action: "query",
        list: "search",
        srprop: "size",
        srlimit:"30",
        redirects:"resolve",
        srsearch: "morelike:"+titles,
        formatversion:"2"
      },

      success: function(result, status){
        vpr.vprint("wiki","moreLike CALLBACK["+titles+"] found:"+vpr.dumpvar(result));
        pageA=result.query.search; // a list of categories
        catA=[];
        pagA=[];
        for(ii=0; ii< pageA.length; ii++){
            var infoA = pageA[ii];
            //vpr.vprint("wiki","moreLike CALBACK page["+ii+"] GOT:"+infoA);
            if(infoA.title.match(/^Category:/i))
              catA.push(infoA);
            else {
              pagA.push(infoA);              
              }

            } //end for
        vpr.vprint("wiki","moreLike  * * DONE * * num cats:"+catA.length+" pages:"+pagA.length);
        if(catA.length>=1)
          wqa.mkPageLinks(catA,{isCat:true, divider:' | ',label:'Suggested:'}); //< this is rare
        if(pagA.length>=1)
          wqa.mkPageLinks(pagA,{divider:' | ',label:'Suggested Pages:'});
      },
      error: function(xhr, result, status){
        vpr.vprint("wiki","moreLike Error for "+status+","+result+","+vpr.dumpvar(xhr));
      }
    });
  }; // end moreLike    

  /**
   queryTitles - Query based on "titles" parameter and return page id.
   If multiple page ids are returned, choose the first one.
   Query includes "redirects" option to automatically traverse redirects.
   All words will be capitalized as this generally yields more consistent results.
   example call:
   https://commons.wikimedia.org/w/api.php?format=json&action=query&redirects=&titles=Horse+breeds&_=1491648441494
   
   RETURN:
   {"batchcomplete":"","query":{"pages":{"1721822":
           {"pageid":1721822,"ns":0,"title":"Horse breeds"}
}}}
   */
  wqa.queryTitles = function(titles,optionsO) {
  linksDiv=(optionsO && optionsO.linksDiv)?optionsO.linksDiv:wqa.linksDiv;
  vpr.vprint("wiki","queryTitles = = START = = "+titles);
  if(optionsO && optionsO.clear)
      wqa.clearDivs('wait',titles,optionsO);
    $.ajax({
      url: API_URL,
      dataType: "jsonp",
      data: {
        format: "json",
        action: "query",
        redirects: "",
        titles: titles
      },

      success: function(result, status) {
        var pages = result.query.pages;
        var pageId = -1;
        vpr.vprint("wiki","queryTitles CALLBACK["+titles+"] got:"+vpr.dumpvar(result));
        for(var key in pages) {
          var page = pages[key];
          // api can return invalid recrods, these are marked as "missing"
          if(!("missing" in page)) {
            pageId = page.pageid;
            break;
          }
        }
        if(pageId > 0) {
          //this is not a CATEGORY only listCategories
          wqa.getThumbsOneShot(pageId,wqa.capitalizeString(titles));
          //if(titles.indexOf("Categor")===0)
          //wqa.getQuality(key,wqa.capitalizeString(titles));
        } else {
          vpr.vprint("wiki","queryTitles CALLBACK * *  No results  * *  , try opensearch on:"+titles);
          wqa.openSearch(pageId,titles);
        }
      },

      error: function(xhr, result, status){
        vpr.vprint("wiki","queryTitles:Error:"+status+","+result+","+vpr.dumpvar(xhr));
      }
    });
  }; // end queryTitles  

  /**
   getThumbsForPage - Get the thumbnail (and full image URL) for ARRAY of PAGES (e.g. File:Shells of marine Mollusc1.jpg).
   
   IN: "images":[{"ns":6,"title":"File:Abra alba 2.jpg"},{"ns":6,"title":"File:Cuncha GFDL Galicia4.jpg"},{"ns":6,"title":"File:Shells From Indian Ocean.jpg"},{"ns":6,"title":"File:Shells of marine Mollusc1.jpg"}]
   
  Example call:
https://commons.wikimedia.org/w/api.php?action=query&titles=File:Shells%20of%20marine%20Mollusc1.jpg&prop=imageinfo&format=json&iiprop=url&iiurlwidth=200

   
    Example response:
{"batchcomplete":"","query":{"pages":{"2601961":{"pageid":2601961,"ns":6,"title":"File:Shells of marine Mollusc1.jpg","imagerepository":"local","imageinfo":[{"thumburl":"https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Shells_of_marine_Mollusc1.jpg/200px-Shells_of_marine_Mollusc1.jpg","thumbwidth":200,"thumbheight":152,"url":"https://upload.wikimedia.org/wikipedia/commons/e/ed/Shells_of_marine_Mollusc1.jpg","descriptionurl":"https://commons.wikimedia.org/wiki/File:Shells_of_marine_Mollusc1.jpg","descriptionshorturl":"https://commons.wikimedia.org/w/index.php?curid=2601961"}]}}}}

   */
  wqa.getThumbsForPage = function(pageId, imagesA, optionsO) {
    var num2do,ii,mytitle,mytitleP="";
    // NOTE DO NOT CLEAR, often called with thumbsoneshot
    thumbsDiv=(optionsO && optionsO.thumbsDiv)?optionsO.thumbsDiv:wqa.thumbsDiv;
    if(typeof imagesA !="object")
      imagesA=[{title:imagesA}];
    num2do=Math.min(50,imagesA.length);
    //
    // LOOP + +
    //
    vpr.vprint("wiki","getThumbsForPage  =  =  =  =  START LOOP of  =  =  =  =  :"+num2do);
    for(ii=0; ii< num2do; ii++){
      if(typeof imagesA[ii] =="object")
        mytitle = imagesA[ii].title;
      else
        mytitle = imagesA[ii];
      mytitleP+=mytitle+"|";
      }
    mytitleP=mytitleP.replace(/.$/,"");
    
    var mydata ={
          format: "json",
          action: "query",
          prop: "imageinfo",
          iiurlwidth: wqa.thumbWidth,  // this will autoadd: thumburl, thumbwidth and thumbheight
          iiurlheight: wqa.thumbWidth,
          titles: mytitleP,
          iiprop: "extmetadata|timestamp|comment|canonicaltitle|url|size|dimensions|sha1|mime|thumbmime|mediatype|bitdepth"
        };    
    if(pageId!=null){// swap titles for pageids
      vpr.vprint("wiki","getThumbsForPage = =  PAGEID MODE with id list:"+pageId);
      mydata['pageids']=pageId;
      delete mydata['titles'];
      }
    vpr.vprint("wiki","getThumbsForPage = on["+ii+"]of["+imagesA.length+"]pageId:"+pageId+":TITLE:"+mytitle);
    $.ajax({
        url: API_URL,
        dataType: "jsonp",
        data: mydata,

      success: function(result, status, jqXHR ){
        var sectionArray = [];
        if(result.query ==null || result.query.pages == null)//probably: {"batchcomplete":""}
          vpr.vprint("wiki","getThumbsForPage CALLBACK["+"titleunknown"+"] result missing pages! got this:" +vpr.dumpvar(result));
          
        var pageA = result.query.pages;
        //this is usually ONE itemvpr.vprint("wiki","getThumbsForPage CALLBACK got pageA keys:" +vpr.iterate(pageA,null,"getkeys"));
        for(key in pageA){
          var infoA = pageA[key].imageinfo[0];
          wqa.mkThumb(infoA,thumbsDiv);
          }
      },
      error: function(xhr, result, status){
        vpr.vprint("wiki","getThumbsForPage:Error !"+status+","+result+","+vpr.dumpvar(xhr));
      }
    }); // end ajax
  }; // end getThumbsForPage

/**
   fastcciCallback - callback: get quality images for given category
  
 important CATS:<br>
  3618826   - quality images  < this seems best
  4143367   - valued images
  3943817   - featured images
ref
http://stackoverflow.com/questions/27433744/how-to-get-with-mediawiki-api-all-images-in-a-category-which-are-not-in-another/28445234#28445234


Call 
https://fastcci.wmflabs.org/?c1=200341&c2=3618826&d1=15&d2=0&s=200&t=js

Return:
fastcciCallback( [ 'RESULT 48561284,0,1|7541527,0,2|40495409,1,2|41495752,1,2|41403108,1,2|40495426,2,2|49118657,2,2|6550144,2,2|32519665,2,2|26405162,2,2|52648767,2,2|39792258,2,2|42670869,2,2|12752304,2,2|14622669,2,2|16093955,2,2|3839077,3,2|15495389,3,2|15495230,3,2|14332822,3,2|27392897,3,2|8022290,3,2|4478432,3,2|46815598,3,2|17818813,3,2|50336016,3,2|52114738,4,2|28468297,5,2|12442576,5,2|17501650,5,2|50336076,5,2|40964672,6,1|34384759,6,1|43067275,6,2|21659145,6,2', 'OUTOF 35', 'DBAGE 1434', 'DONE'] );

RESULT followed by a | separated list of up to 50 integer triplets of the form pageId,depth,tag. Each triplet stands for one image or category

NO RESULTS:
fastcciCallback( [ 'OUTOF 0', 'DBAGE 6598', 'DONE'] );
*/
window.fastcciCallback = function(result){
  var fileA=[];
  qualityDown=false;
  if(result ==null || result.length == null){//probably: {"batchcomplete":""}
          vpr.vprint("misc","getQuality CALLBACK["+"titleunknown"+"] result missing pages! got this:" +vpr.dumpvar(result));
          return;
          }      
  var ii,pageA = result[0];
  if(pageA=="OUTOF 0")
    vpr.vprint("misc","getQuality CALLBACK found nothing");
  else {
    pageA=pageA.replace(/RESULT\s*/,"");
    pageA=pageA.split(/\|/);
    vpr.vprint("misc","getQuality CALLBACK got a split count:"+pageA.length+" loop these pageIDs:   "+pageA);
    //this is usually ONE itemvpr.vprint("wiki","getQuality CALLBACK got pageA keys:" +vpr.iterate(pageA,null,"getkeys"));
    for(ii=0; ii<pageA.length; ii++){
      fileA.push(pageA[ii].split(/,/)[0]);
      }
    wqa.getThumbsForPage(fileA.join('|'),"nada");
    } // found stuff
  };
  //
  //
  //
  wqa.getQuality = function(catId,imagesA, optionsO) {
    var num2do,ii,mytitle,mytitleP="";
    // NOTE DO NOT CLEAR, often called with thumbsoneshot
    thumbsDiv=(optionsO && optionsO.thumbsDiv)?optionsO.thumbsDiv:wqa.thumbsDiv;
    if(catId =='631175' || catId==631175){//https://fastcci.wmflabs.org/?t=js&d1=15&d2=0&c1=631175&c2=3618826&s=200
                  vpr.vprint("misc","findCatId skip DEFAULT landscapes");
                  return;
        }
    msg="getQuality  =  =  =  =  START  =  =  =  =  cat:"+catId;
    //alert(msg);
    vpr.vprint("misc",msg);
    if(qualityDown)
      vpr.vprint("misc","getQuality was flagged down or busy!");
    else{
      qualityDown=true;
      $.ajax({
          url: 'https://fastcci.wmflabs.org/',
          dataType: "jsonp",
          jsonpCallBack: 'fastcciCallback',// 
          cache: true,
          timeout: 20000, // wait up to 20 seconds
          data: {
            t: "js",
            d1: "15",
            d2: "0",
            c1: catId,
            c2: "3618826",
            s: "200"
          }
      
    }); // end ajax
    }
  }; // end getQuality
  
  /**
   getThumbsOneShot - Get thumbs and full image url in one query
   a oneshot url:
https://commons.wikimedia.org/w/api.php?action=query&generator=images&prop=imageinfo&gimlimit=500&redirects=1&titles=Cat&iiurlwidth=200&iiprop=timestamp|thumburl|comment|canonicaltitle|url|size|dimensions|sha1|mime|thumbmime|mediatype|bitdepth

returns:
"query": {
        "redirects": [
            {
                "from": "File:Naissance.ogg",
                "to": "File:Naissance.ogv"
            }
        ],
        "pages": {
            "918462": {
                "pageid": 918462,
                "ns": 6,
                "title": "File:2006-07-03 Katze1.jpg",
                "imagerepository": "local",
                "imageinfo": [
                    {
                        "timestamp": "2006-07-03T21:50:36Z",
                        "size": 501262,
                        "width": 2400,
                        "height": 1180,
                        "comment": "{{Information\n|Description=cat, 7 weeks old\n|Source=own work\n|Date=2006-07-03\n|Author=Stephan Czuratis (~~~)\n|Permission=CC-BY-SA-2.5\n}}",
                        "canonicaltitle": "File:2006-07-03 Katze1.jpg",
                        "thumburl": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/2006-07-03_Katze1.jpg/200px-2006-07-03_Katze1.jpg",
                        "thumbwidth": 200,
                        "thumbheight": 98,
                        "thumbmime": "image/jpeg",
                        "url": "https://upload.wikimedia.org/wikipedia/commons/8/8e/2006-07-03_Katze1.jpg",
                        "descriptionurl": "https://commons.wikimedia.org/wiki/File:2006-07-03_Katze1.jpg",
                        "descriptionshorturl": "https://commons.wikimedia.org/w/index.php?curid=918462",
                        "sha1": "6b450a907224f3fde4975413d49dc0510af060e1",
                        "mime": "image/jpeg",
                        "mediatype": "BITMAP",
                        "bitdepth": 8
                    }
                ]
            },
            
            NEWER:
xxx={["6979029":{"pageid":6979029,"ns"
:6,"title":"File:1.2.09.Forest.cSmall.jpg","imagerepository":"local","imageinfo":[{"timestamp":"2009-06-15T09
:32:21Z","size":62493,"width":500,"height":297,"comment":"Remove watermark reading \"Photo: www.wingedhorseproductions
.com\" \"CM Bedford Forrest - 3/4 Cleveland Bay 1/4 Thoroughbred Stallion, Aus.\", levels, sharpness"
,"canonicaltitle":"File:1.2.09.Forest.cSmall.jpg","thumburl":"https://upload.wikimedia.org/wikipedia
/commons/thumb/5/5e/1.2.09.Forest.cSmall.jpg/200px-1.2.09.Forest.cSmall.jpg","thumbwidth":200,"thumbheight"
:119,"thumbmime":"image/jpeg","url":"https://upload.wikimedia.org/wikipedia/commons/5/5e/1.2.09.Forest
.cSmall.jpg","descriptionurl":"https://commons.wikimedia.org/wiki/File:1.2.09.Forest.cSmall.jpg","descriptionshorturl"
:"https://commons.wikimedia.org/w/index.php?curid=6979029","sha1":"f5773cc425e629dadfcfa3e6a9b6a714dddbd8c8"
,"extmetadata":{"DateTime":{"value":"2009-06-15 09:32:21","source":"mediawiki-metadata","hidden":""}
,"ObjectName":{"value":"1.2.09.Forest.cSmall","source":"mediawiki-metadata","hidden":""},"CommonsMetadataExtension"
:{"value":1.2,"source":"extension","hidden":""},
"Categories":{"value":"Cleveland Bay Sporthorse|GFDL
|License migration redundant|Self-published work|Yorkshire Coach Horse","source":"commons-categories"
,"hidden":""},
"Assessments":{"value":"","source":"commons-categories","hidden":""},"ImageDescription"
:{"value":"CM Bedford Forrest - a 3/4 Cleveland Bay Stallion by Forest Field Day out of a Billara Padbury
 mare.  Forrest is an example of what was known as the Yorkshire Coach Horse being 3/4 Cleveland Bay
.  He is a prime example of an athletic yet nicely built Cleveland Bay Sporthorse Stallion suited for
 all disciplines.","source":"commons-desc-page"},"DateTimeOriginal":{"value":"2009-02-01","source":"commons-desc-page"
},"Credit":{"value":"<span class=\"int-own-work\" lang=\"en\">Own work</span>","source":"commons-desc-page"
,"hidden":""},"Artist":{"value":"<a href=\"//commons.wikimedia.org/w/index.php?title=User:CMSporthorses
&amp;action=edit&amp;redlink=1\" class=\"new\" title=\"User:CMSporthorses (page does not exist)\">CMSporthorses
</a>","source":"commons-desc-page"},"LicenseShortName":{"value":"CC BY-SA 3.0","source":"commons-desc-page"
,"hidden":""},"UsageTerms":{"value":"Creative Commons Attribution-Share Alike 3.0","source":"commons-desc-page"
,"hidden":""},"AttributionRequired":{"value":"true","source":"commons-desc-page","hidden":""},"LicenseUrl"
:{"value":"http://creativecommons.org/licenses/by-sa/3.0","source":"commons-desc-page","hidden":""},"Copyrighted"
:{"value":"True","source":"commons-desc-page","hidden":""},"Restrictions":{"value":"","source":"commons-desc-page"
,"hidden":""},"License":{"value":"cc-by-sa-3.0","source":"commons-templates","hidden":""}},"mime":"image
/jpeg","mediatype":"BITMAP","bitdepth":8}]};
   */
  wqa.getThumbsOneShot = function(pageId, titles, optionsO) {
    thumbsDiv=(optionsO && optionsO.thumbsDiv)?optionsO.thumbsDiv:wqa.thumbsDiv;
  vpr.vprint("wiki","getThumbsOneShot  = = START   = =  pageid:"+pageId+" title:"+titles); 
  if(optionsO && optionsO.clear)
      wqa.clearDivs('wait',titles,optionsO);
    mydata = {
        format: "json",
        action: "query",
        titles: titles,
        generator: "images",
        prop: "imageinfo",
        redirects: "resolve",
        gimlimit:"500",
        iiurlwidth:wqa.thumbWidth,
        iiurlheight: wqa.thumbWidth,
        iiprop:"extmetadata|timestamp|comment|canonicaltitle|url|size|dimensions|sha1|mime|thumbmime|mediatype|bitdepth"
        
      };
      if(pageId>0){// swap titles for pageids
          mydata['pageids']=pageId;
          delete mydata['titles'];
        }
    else if(optionsO.isInitSearch==null) // title, also try  the CAT
      wqa.findCatId(null,wqa.catagorizeString(titles));
    //         A  J  A  X
    $.ajax({
      url: API_URL,
      dataType: "jsonp",
      data: mydata,

      success: function(result, status){
        var jpgA,fileA,catA,catO,ii;  
        jpgA=[];
        fileA=[];
        catO={};
        if(result.query==null){
          vpr.vprint("wiki","getThumbsOneShot CALLBACK NOTHING FOUND, try openSearch["+titles+"]:"+vpr.dumpvar(result));
          //wqa.mkCatLinks([titles],thumbsDiv);
          titleA = titles.split(/\|/);
          if(titleA.length>1)
            titles=titleA[1]; //category only
          wqa.openSearch(pageId,titles);
          }
        else{// getThumbsOneShot----------------------------   P R O C E S S   ---------------------------- 
          var pageA = result.query.pages;
          vpr.vprint("wiki","getThumbsOneShot CALLBACK["+titles+"] GOT num pages[ "+vpr.size(pageA)+" ] options:"+vpr.dumpvar(optionsO));
          // LOOP
            for(key in pageA){
              vpr.vprint("wiki","getThumbsOneShot ["+key+"]title:"+pageA[key].title+":");
              if(pageA[key].title.match(/Redirect arrow/)){
                vpr.vprint("wiki","getThumbsOneShot looks like a    X X  REDIRECT X X   stop here and resolve");
                wqa.findRedirect(null,titles.split(/\|/)[1]);
                return;
                }
              else if(pageA[key].imageinfo==null)// expect just a File {"pageid":39646145,"ns":6,"title":"File:Mariposas del ocaso.jpg"}
                fileA.push(pageA[key].title);
              else{ //                             have imginfo
                var infoA = pageA[key].imageinfo[0];
                if(infoA.url.match(/.*(jpg|jpeg|png|gif)$/i))
                  jpgA.push(infoA);
                else
                  vpr.vprint("wiki","getThumbsOneShot CALBACK ignoring:"+infoA.url);
                /*                could extract categories here: fileA.extmetadata.categories
                seems to mostly useless: images in undefined category, unclassified images crap
                */
                if(infoA.extmetadata!=null && infoA.extmetadata.Categories!=null){// will often have dups but the hashing will ignore it
                  catA=infoA.extmetadata.Categories.value.split(/\|/);
                  for(ii=0; ii<catA.length;ii++)
                    catO[catA[ii] ]=catA[ii];
                  }
                }
              } // end LOOP
        //+" catO:"+vpr.dumpvar(catO)
            vpr.vprint("wiki","getThumbsOneShot CALLBACK  =========== FOUND ==============  num jpg:"+jpgA.length+" num File:"+fileA.length);
            
            if(jpgA.length>0)
              wqa.mkThumb(jpgA);
            if(fileA.length>0)
              wqa.getThumbsForPage(null,fileA);
            if(jpgA.length<2 && fileA.length<2) { // found nothing or not much
              vpr.vprint("wiki","getThumbsOneShot CALLBACK got stuff but no jpg trying listCategories:"+titles);
              titleA = titles.split(/\|/);
              if(titleA.length>1)
                titles=titleA[0]; //category only
              wqa.listCategories(-1,"Category:"+titles);
              }
            else {  // found stuff offer suggestions
              wqa.moreLike(pageId, titles);
              }
              vpr.vprint("wiki","getThumbsOneShot CALLBACK  =========== DONE ==============");
            } // end else have query
      },  // end success
      error: function(xhr, result, status){
        vpr.vprint("wiki","getThumbsOneShot Error "+status+","+result+","+vpr.dumpvar(xhr));
      }
    });
  }; // end getThumbsOneShot

  
  /**
   mkThumb - make a thumbnail for given image(s), this function makes DIV WRITES
   if we have infoA:
   size - kb, width, height
   "extmetadata": {
                            "DateTime": {
                                "value": "2014-10-01 05:15:41",
                                "source": "mediawiki-metadata",
                                "hidden": ""
                            },
                            "ObjectName": {
                                "value": "\" 08 - ITALY - Forl\u00ec under snow - suggestive winter landscape of city (christmas)",
                                "source": "mediawiki-metadata",
                                "hidden": ""
                            },
                            "CommonsMetadataExtension": {
                                "value": 1.2,
                                "source": "extension",
                                "hidden": ""
                            },
                            "Categories": {
                                "value": "2000s mountains|Buildings and structures in Italy in snow|Flickr images reviewed by FlickreviewR|Images with annotations|Mountains of Emilia-Romagna|Mountains with snow|Panoramics of mountains in Italy|Predappio|Sant'Antonio (Predappio)|Snow-covered roofs|Snow in Forl\u00ec|Snowy landscapes in Italy|Taken with Nikon D40|Trees in Italy in snow|Winter in Forl\u00ec",
                                "source": "commons-categories",
                                "hidden": ""
                            },
                            "Assessments": {
                                "value": "",
                                "source": "commons-categories",
                                "hidden": ""
                            },
                            "ImageDescription": {
                                "value": "Vista di Predappio (Forl\u00ec) sotto la neve pochi giorni dopo natale",
                                "source": "commons-desc-page"
                            },
                            "DateTimeOriginal": {
                                "value": "2008-12-29",
                                "source": "commons-desc-page"
                            },
                            "Credit": {
                                "value": "<a rel=\"nofollow\" class=\"external free\" href=\"https://www.flickr.com/photos/andre5/3147360727\">https://www.flickr.com/photos/andre5/3147360727</a>",
                                "source": "commons-desc-page",
                                "hidden": ""
                            },
                            "Artist": {
                                "value": "Andrea <a rel=\"nofollow\" class=\"external autonumber\" href=\"https://www.flickr.com/photos/andre5/\">[1]</a>",
                                "source": "commons-desc-page"
                            },
                            "LicenseShortName": {
                                "value": "CC BY-SA 2.0",
                                "source": "commons-desc-page",
                                "hidden": ""
                            },
                            "UsageTerms": {
                                "value": "Creative Commons Attribution-Share Alike 2.0",
                                "source": "commons-desc-page",
                                "hidden": ""
                            },
                            "AttributionRequired": {
                                "value": "true",
                                "source": "commons-desc-page",
                                "hidden": ""
                            },
                            "LicenseUrl": {
                                "value": "http://creativecommons.org/licenses/by-sa/2.0",
                                "source": "commons-desc-page",
                                "hidden": ""
                            },
                            "Copyrighted": {
                                "value": "True",
                                "source": "commons-desc-page",
                                "hidden": ""
                            },
                            "Restrictions": {
                                "value": "",
                                "source": "commons-desc-page",
                                "hidden": ""
                            },
                            "License": {
                                "value": "cc-by-sa-2.0",
                                "source": "commons-templates",
                                "hidden": ""
                            }
   */
  wqa.mkThumb = function(infoA,optionsO) {
    var ii,zt;
    thumbsDiv=(optionsO && optionsO.thumbsDiv)?optionsO.thumbsDiv:wqa.thumbsDiv;
    vpr.vprint("wiki","mkThumb type("+typeof(infoA)+"),size:"+infoA.length+" div:"+thumbsDiv.prop('id')+":");
  if(thumbsDiv.need2clear){
    thumbsDiv.need2clear=false;
    thumbsDiv.html('');
    vpr.vprint("wiki","mkThumb X X CLEAR WAIT");
    }
    if(typeof infoA=="object" && infoA.length !=null)
      ;//OK
    else if(typeof infoA!="array")
      infoA = [infoA];

    for(ii=0;ii<infoA.length;ii++){
      zt=infoA[ii];
      zclass='class="gnlv-thumb-div"';
      belowimg="";blurb="";thelicense="";thecredit="";
			zt_small={};
      if(zt.size!=null){
        if(zt.size>15000000){// dont even use
          vpr.vprint("wiki","mkThumb X X SKIP huge size:"+zt.title);
          continue;
          }
        else if(zt.width< 500 || zt.height < 500){
          vpr.vprint("wiki","mkThumb X X SKIP low res image under 500:"+zt.width+":"+zt.height);
          continue;
          }
        else if(zt.size>10000000)
          zclass='class="gnlv-thumb-div gnlv-border-red"';
        else if(zt.size>5000000)
          zclass='class="gnlv-thumb-div gnlv-border-orange"';
        sizemb = vpr.dd(parseInt(zt.size)/1000000.0)+"mb";
        blurb += ' title="width:'+zt.width+' height:'+zt.height+' size:'+sizemb+' license:unknown"';
        if(zt.extmetadata!=null){//extmetadata
          //  $("<p>").html(zt.extmetadata.UsageTerms.value).text()
					thelicense = ((zt.extmetadata.UsageTerms!=null)?   zt.extmetadata.UsageTerms.value  :"unknown");
					thelicense=$('<div />').html(thelicense.replace(/[\n\r]/g,"") ).text();
          blurb=blurb.replace("unknown",thelicense  );
          // descriptions can be long! belowimg+=(zt.extmetadata.ImageDescription!=null)?"Desc:"+zt.extmetadata.ImageDescription.value+"<br>":"";
          if(zt.extmetadata.AttributionRequired && zt.extmetadata.Credit &&zt.extmetadata.Artist&& zt.extmetadata.AttributionRequired.value=="true"){
						thecredit = (zt.extmetadata.Credit.value.match(/Own work/i))?zt.extmetadata.Artist.value:zt.extmetadata.Credit.value;
            belowimg+=thecredit;
						}
					}
				zt_small={size:zt.size,width:zt.width,height:zt.height,license:thelicense,credit:$('<div />').html(thecredit).text()};
				} // end size
      // blurb reducing
			spanSize="";
      if(belowimg.length>100){      
				spanSize='style="display:block;max-width:'+zt.thumbwidth*wqa.mshrink*2+'px"';
        // see if "all link"
        // <a rel="nofollow" class="external text" href="http://www.flickr.com/photos/12568962@N00/527708116/">Beach Della Pelosa</a>
        $belowimg = $('<div />').html(belowimg);
        if($belowimg.children('a').length ==1  && $belowimg.children().length ==1 && $belowimg.text().length < 120){ //single link od
          // catch links-as-text and shorten https://www.flickr.com/photos/andre5/3147360727
          thelink = $belowimg.children('a').prop('href');
           if($belowimg.text().match(/flickr.com/i) || $belowimg.text() ==thelink ) {
            thelink = vpr.getQueryDomain(thelink);
            $belowimg.children('a').text(thelink);
            belowimg = $belowimg.html();
            }
          }
        else {
          vpr.vprint("wiki","mkThumb X X SKIP verbose blurb numchildren:"+$belowimg.children().length+":"+belowimg);
          continue;
          }
        }
      if(belowimg!='')
        belowimg=" credit:"+belowimg;
      if(belowimg.match(/self/i)||belowimg.match(/machine/i))
        belowimg=''; // skip amateur "taken by self, myself, self"
    // < - - W R I T E   TO   D I V    
      thumbsDiv.append('<div '+zclass+'><img width="'+zt.thumbwidth*wqa.mshrink+'" height="'+zt.thumbheight*wqa.mshrink+'"  onClick="vpr.wkUsePic('+'jQuery(this)'+')" src="'+zt.thumburl+'" data-url="'+zt.url+'"  '+blurb+' data-full="'+vpr.dumpvar(zt_small).replace(/"/g,"'")+'" /><br><span '+spanSize+'>'+belowimg+'</span></div>');
			//fix all links
			thumbsDiv.find('span a').prop("target","_blank");
      }
  } // end mkThumb
  /**
   capitalizeString - Capitalize the first letter of each word
   20170321 cmm only do very first letter, test case: Pine cone  alternative is Pine cone|Pine Cone
   */
  wqa.capitalizeString = function(input) {
    var inputArray = input.split(' ');
    var output = [];
    stemp = input.charAt(0).toUpperCase()+ input.slice(1);
    stemp = stemp.replace(/\&#8217;/g,"'").replace(/[\u2018\u2019]/g,"'"); // fancy quot to singlequote
    return stemp;                   /// RETURN early
    
    for(s in inputArray) {
      output.push(inputArray[s].charAt(0).toUpperCase() + inputArray[s].slice(1));
    }
    return output.join(' ');
  };
  /**
   catagorizeString - Capitalize the first letter of each word
   20170321 cmm only do very first letter, test case: Pine cone  alternative is Pine cone|Pine Cone
   */
  wqa.catagorizeString = function(input) {
    var inputArray = input.split(' ');
    var output = [];
    stemp = input.charAt(0).toUpperCase()+ input.slice(1);
  
    for(s in inputArray) {
      // 20170413 sometimes want uppercase, sometimes dont charAt(0).toUpperCase()
    output.push(inputArray[s].charAt(0) + inputArray[s].slice(1));
    }
    return 'Category:'+output.join('_');
  };
  /**
   clearDivs - clear out divs show wait icon and handle history stack
   args - mode =[wait|regular] for wait, show spinner
        - title, NeW title to be loaded
   */
  wqa.clearDivs= function(mode,title,optionsO){
    vpr.vprint("wiki","X X X X X X X X X X X X clearDivs("+mode+") X X X X X X X X X X X X");
    clearwith =(wqa.waiticon !=null && mode=="wait")?wqa.waiticon:'';
    if(mode=="wait") {// store up * HISTORY *
      if(wqa.linksDiv.html()!=''){
        //alert("history push! from size:"+historyA.length);
        historyA.push(wqa.linksDiv.html());
        historytA.push(wqa.thumbsDiv.html());
        if(optionsO && optionsO.setPrevSearch) { //TYPED input search: use presearch
          historyiA.push(prevsearch );
          prevsearch = wqa.inputEl.val();
          }
        else{ //                                  CLICK link search
          historyiA.push(wqa.inputEl.val() );// save CURRENT title
          // set NEW title ... strip any Category: or underscore
          wqa.inputEl.val(title.replace(/^Category:/,"").replace(/_/g," "));
          prevsearch =title.replace(/^Category:/,"").replace(/_/g," ");
          }
        $('#'+API_NAME+'goback').removeClass('gnlv-gone');
        } // end links not empty
      } // end wait mode
    if(dontclearcats>0){ // this is used for category disambiguation, usually cant come in before
      dontclearcats--;
      vpr.vprint("wiki","X X  clearDivs.linksDiv had a dont clear flag!:"+dontclearcats);
      }
    else {
        wqa.linksDiv.html(clearwith);  // < - -  - CLEAR
        if(mode=="wait")
          wqa.linksDiv.need2clear=true;
        }
      wqa.thumbsDiv.html(clearwith);     // < - -  - CLEAR
      if(mode=="wait")
        wqa.thumbsDiv.need2clear=true;
    }// end clearDivs
  /**
   goBackl - pop history stacks and load to appropriate divs
   */
  wqa.goBackl= function(){
    if(historyA.length==0)
      return;
    else if(historyA.length==1) // last pop
      $('#'+API_NAME+'goback').addClass('gnlv-gone');      
    //alert("goBackl going back from size:"+historyA.length);
    wqa.linksDiv.html(historyA.pop());
    wqa.thumbsDiv.html(historytA.pop());
    prevsearch=historyiA.pop();
    wqa.inputEl.val(prevsearch);
    }
  /**
  getLastSearch - get last item on history stack
   */
  wqa.getLastSearch= function(){
    return prevsearch;
    //return(historyA[historyA.length-1]) 
    }
 // return wqa;
};
