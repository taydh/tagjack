/**
 library name: taydh\tagjack
 author: taufan_ay@yahoo.com
 desctiption: simple javascript tag-injection ("tag-hijack") library for dynamic html page
 dependencies: jquery (mandatory), mustachejs (optional)

 limitation:
 the template content by default injected into a shadow element first to get all benefit from jquery
 however, by doing so, browser will make adjustment to content text so its might not the same as the original content text anymore
 known issues are:
 - browser will change property values to lowercase: this will 
 */

var Tagjack = {};

Tagjack.CONTENT 				= 1
Tagjack.CONTENTSCRIPT 	= 2
Tagjack.SCRIPT 					= 3

Tagjack.TRAILFORMAT_DEFAULT = 1
Tagjack.TRAILFORMAT_DAILY 	= 2

Tagjack.MODE_APPEND 	= 1
Tagjack.MODE_PREPEND 	= 2
Tagjack.MODE_BEFORE 	= 3
Tagjack.MODE_AFTER 		= 4
Tagjack.MODE_REPLACE 	= 5

Tagjack.scripts 			= {};
Tagjack._contents 		= {};
Tagjack._trailFormat 	= 'DEFAULT';
Tagjack._keepTemplate 	= true;
Tagjack._useTrail 		= false;

Tagjack.isDevMode = function(isDevMode)
{
    if(isDevMode){
        Tagjack._keepTemplate = false;
        Tagjack._useTrail = true;
    } else {
        Tagjack._keepTemplate = true;
        Tagjack._useTrail = false;
    }
}

Tagjack.getTimeString = function()
{ 
	return new Date().getTime() + '_' + Math.floor((Math.random() * 100) + 1); 
}

Tagjack.joinPath = function(path, templateName)
{
	if(path.charAt(path.length - 1) != '/'){ path += '/'; }
	return path + templateName;
}

Tagjack.replaceId = function(obj)
{
	if(typeof obj === 'string'){
		obj = $('#'+obj)
	}
	
	// old code
	var newID = ((obj.attr('id') !== undefined) ? (obj.attr('id') + '_') : '') + Tagjack.getTimeString();
	obj.attr('id', newID);

	return newID;
}

Tagjack.getTemplateId = function(path, templateName)
{
	return Tagjack.joinPath(path, templateName).replace(/\//g,'_');
}
	
Tagjack.getTemplateScriptName = function(templateName)
{
	return templateName.replace(/\//g, '_');
}

Tagjack.registerContent = function(path, templateName, cached, next)
{
	var templateId = Tagjack.getTemplateId(path, templateName);
	//console.log('check qpanel template: '+templateId);
	
	if(!Tagjack._keepTemplate || Tagjack._contents[templateId] === undefined){
		
		let url = Tagjack.joinPath(path, templateName) + '.htm';
		
		switch(Tagjack._trailFormat){
		case 'DAILY':
			cached = true;
			url += '?_'+(new Date()).toDateString().replace(/\ /g,'');
			break;
		case 'DEFAULT':
		default:
			break;
		}
		
		$.ajax({
			url: url,
			dataType: "text",
			cache: cached,
			success: function(content){
				Tagjack._contents[templateId] = content;
				next();
			}}).fail(function(){
				console.log('(me) ReContent Error: '+arguments[0].status+' on "'+url+'"');
				next();
			});
	}
	else{
		next();
	}
}

Tagjack.registerScript = function(path, templateName, cached, next)
{
	//console.log('check load script: '+Tagjack.GetTemplateScriptName(templateName));
	if(!Tagjack._keepTemplate || typeof Tagjack.scripts[Tagjack.getTemplateScriptName(templateName)] !== 'function'){
		
		let url = Tagjack.joinPath(path, templateName) + '.js';
		
		switch(Tagjack._trailFormat){
		case 'DAILY':
			cached = true;
			url += '?_'+(new Date()).toDateString().replace(/\ /g,'');
			break;
		case 'DEFAULT':
		default:
			break;
		}
		
		$.ajax({
			url: url,
			dataType: "script",
			cache: cached,
			contentType: "text/script",
			success: function(){
				if(typeof Tagjack.scripts[Tagjack.getTemplateScriptName(templateName)] === 'function'){
					//console.log('(me) Script loaded: ' + Tagjack.GetTemplateScriptName(templateName));
				}
				else{
					console.log('(me) Invalid function for Tagjack.Scripts.'+Tagjack.getTemplateScriptName(templateName));
				}
			
				next();
			}}).fail(function(){
				if(arguments[0].status == 200){
					//console.log(arguments);
					console.log('RegScript error: ' + templateName + '\n'
						+ arguments[2] + ' (line: ' + arguments[2].lineNumber+ ')');
				}
				
				next();
			});
	}
	else{
		next();
	}
}

Tagjack.getAddTemplateInfoDefault = function()
{
	return {
		loadType: 'plain', //>> plain | content-only (will remove Mustache template) | content-and-script | script-only
		placement: 'append', //>> prepend | append | before | after
		container: '',
		path: '',
		templateName: '',
		useTrail: Tagjack._useTrail,
		scriptArgs: {},
		next: function(){},
		counter: null,
	}
}

// Mustache must only applied before any jquery event handling
Tagjack.applyContentTemplating = function(shadowid, args)
{
    var shadow = document.getElementById(shadowid);
    shadow.innerHTML = Mustache.render(shadow.innerHTML, args);
}

Tagjack.insertTemplate = function(info)
{
	if(info.counter !== null) info.counter.count();
    
	var applyScript = function(info){
		// create a "shadow DOM"
		var templateId = Tagjack.getTemplateId(info.path, info.templateName);
		var shadow = document.createElement('div');
		shadow.id = '_shadow_' + Tagjack.getTimeString();
		shadow.setAttribute('style','display:none');
        
        shadow.innerHTML = (typeof Tagjack._contents[templateId] !== 'undefined')
            ? Tagjack._contents[templateId]
            : "(Tagjack Template Not Found: <em>"+Tagjack.joinPath(info.path, info.templateName)+"</em>)";
        
		document.body.appendChild(shadow);
		
		var containerObj = (typeof(info.container) === 'object') ? info.container : $('#'+info.container);
		var refObj = scriptObj = null;
		var resObj = {};
		
		if(typeof Tagjack.scripts[Tagjack.getTemplateScriptName(info.templateName)] === 'function'){
			
			refObj = {
				container:containerObj,
				shadow:$(shadow), 
				args:info.scriptArgs,
				templateName:info.templateName,
				path:info.path,
				getRaw: function() { return Tagjack._contents[templateId] },
				take: function(selector){
					let el = this.shadow.find(selector)
					let tmp = el.html()
					el.remove()
					return tmp
				},
				find: function(selector) { return this.shadow.find(selector) }
			}
			var params = [refObj, resObj]
			Tagjack.scripts[Tagjack.getTemplateScriptName(info.templateName)].apply(this, params)
                
//            } catch(err){
//                console.log('ERROR in ' + Tagjack.GetTemplateScriptName(info.templateName) + ': ' + err.message);
//            }
		}
		else if(info.loadType == 'content-only' && typeof Mustache !== 'undefined'){ // apply mustachejs
			 Tagjack.applyContentTemplating(shadow.id, info.scriptArgs);
		}
        
        var shadowContent = $(shadow).contents();

        //console.log(info)
        //console.log(containerObj)
		//console.log(shadowContent.html())

        switch(info.placement){
        case Tagjack.MODE_APPEND: containerObj.append(shadowContent); break;
        case Tagjack.MODE_PREPEND: containerObj.prepend(shadowContent); break;
        case Tagjack.MODE_BEFORE: containerObj.before(shadowContent); break;
        case Tagjack.MODE_AFTER: containerObj.after(shadowContent); break;
				case Tagjack.MODE_REPLACE: containerObj.replaceWith(shadowContent); break;
        default: 
            console.log('Tagjack: unknown AddContent placement info "' + info.placement + '", append instead');
            containerObj.append(shadowContent);
            break;
        }

        //console.log('Tagjack done '+ info.templateName + ' to ' + containerObj.attr('id'));

        // remove shadow
        $(shadow).remove();
        
		// run onload function if exists after template moved to container
		if(refObj != null){
			if(refObj.onload || false) refObj.onload(shadowContent);
			else if(refObj.onLoad || false) refObj.onLoad(shadowContent);
		}

		return resObj;
	};
	
	switch(info.loadType){
	case 'plain':
	case 'content-only':
		Tagjack.registerContent(info.path, info.templateName, !info.useTrail, function(){
			var result = applyScript(info);
			info.next(result);
			if(info.counter !== null) info.counter.done();
		});
		break;
	case 'content-and-script':
		Tagjack.registerContent(info.path, info.templateName, !info.useTrail, function(){
			Tagjack.registerScript(info.path, info.templateName, !info.useTrail, function(){
				var result = applyScript(info);		
				info.next(result);
				if(info.counter !== null) info.counter.done();
			});
		});
		break;
	case 'script-only':
		Tagjack.registerScript(info.path, info.templateName, !info.useTrail, function(){
			var result = applyScript(info);
			info.next(result);
			if(info.counter !== null) info.counter.done();
		});
		break;
	default:
		console.log('Tagjack: unknown AddContent type - library error!');
		break;
	}
}

Tagjack.ExecutionChain = function(placement, container, path, templateName)
{
	this.info = Tagjack.getAddTemplateInfoDefault();
	
	this.info.placement = placement;
	this.info.container = container;
	this.info.path = path;
	this.info.templateName = templateName;

	this.content = function(args)
	{
		this.info.loadType = 'content-only';
		this.info.scriptArgs = (args === undefined) ? {} : args;
		return this;
	}

	this.contentscript = function(args)
	{
		this.info.loadType = 'content-and-script';
		this.info.scriptArgs = (args === undefined) ? {} : args;
		return this;
	}
	
	this.script = function(args)
	{
		this.info.loadType = 'script-only';
		this.info.scriptArgs = (args === undefined) ? {} : args;
		return this;
	}
	
	this.count = function(sequencer)
	{
		if(sequencer !== undefined) this.info.sequencer = sequencer;
		return this;
	};
	
	this.cached = function(isCached)
	{
		if(isCached !== undefined) this.info.useTrail = !isCached;
		return this;
	}
	
	this.done = function(f_next)
	{
		if(typeof f_next === 'function') this.info.next = f_next;
		
		Tagjack.insertTemplate(this.info);
	};
}

/* MAIN TEMPLATE INSERT */

Tagjack.createSequencer = function(onComplete)
{
	return new function() 
	{
		this.onComplete = onComplete;
		this.counter = 0;
		this.done = function(next){
				this.counter--;
				//console.log('count: '+this.counter);
				if (this.counter == 0 && this.onComplete) this.onComplete();
				if (next) next();
			};
		this.count = function(){
				this.counter++;
			};
	}();
}

Tagjack.include = function(placement, container, path, templateName, scriptArgs)
{
	if(typeof path === 'undefined'){
		throw "[Tagjack] Invalid path for template "+templateName
	}
	
	return new Tagjack.ExecutionChain(placement, container, path, templateName, scriptArgs);
}

Tagjack.removeTemplate = function(path, templateName)
{
	var templateId = Tagjack.getTemplateId(path, templateName)
	var templateScriptName = Tagjack.getTemplateScriptName(templateName)
	if(Tagjack._contents[templateId] !== undefined) delete Tagjack._contents[templateId]
	if(Tagjack.scripts[templateScriptName] !== undefined) delete Tagjack.scripts[templateScriptName]
}

Tagjack.removeAllTemplates = function()
{
	Tagjack._contents = {}
	Tagjack.scripts = {}
}

/* SHORTCUT INSERT */

// Tagjack.insertTo = function(target, path, templateName)
// {
// 	return Tagjack.include('INSERT', target, path, templateName);
// }

Tagjack.put = function(target, path, templateName)
{
	target.empty()
	return Tagjack.include(Tagjack.MODE_APPEND, target, path, templateName);
}

Tagjack.appendTo = function(target, path, templateName)
{
	return Tagjack.include(Tagjack.MODE_APPEND, target, path, templateName);
}

Tagjack.prependTo = function(target, path, templateName)
{
	return Tagjack.include(Tagjack.MODE_PREPEND, target, path, templateName);
}

Tagjack.insertBefore = function(target, path, templateName)
{
	return Tagjack.include(Tagjack.MODE_BEFORE, target, path, templateName);
}

Tagjack.insertAfter = function(target, path, templateName)
{
	return Tagjack.include(Tagjack.MODE_AFTER, target, path, templateName);
}

Tagjack.replace = function(target, path, templateName)
{
	return Tagjack.include(Tagjack.MODE_REPLACE, target, path, templateName);
}

/* LOAD TEMPLATE WITHOUT INSERTING */

Tagjack.registerTemplates = function(templateArgList, next)	
{
	let count = templateArgList.length
	let path, templateName, type, cached = null
	
	for(let arg of templateArgList){
		// [0] => path
		// [1] => templateName
		// [2] => type
		// [3] => cached
		
		path 			= arg[0]
		templateName 	= arg[1]
		type 			= arg[2] || Tagjack.CONTENT
		cached 			= arg[3] || true
		
		if(type == Tagjack.CONTENTSCRIPT) count++
			
		if(type == Tagjack.CONTENT || type == Tagjack.CONTENTSCRIPT){
			Tagjack.registerContent(path, templateName, cached, function(){
				if(--count == 0 && next){ next() }
			});			
		}
		
		if(type == Tagjack.CONTENTSCRIPT || type == Tagjack.SCRIPT){
			Tagjack.registerScript(path, templateName, cached, function(){
				if(--count == 0 && next){ next() }
			});
		}
	}
}