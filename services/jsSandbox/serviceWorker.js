var vm = require('vm')
var fs = require('fs')
var apiTools = require('../../jsSandboxLib/apiTools.js')
var remotingTools = require('../../jsSandboxLib/remotingTools.js')
var Fiber = require('fibers')

sendToSupervisor = function(msg) {
	console.log(JSON.stringify(msg))
}

var api = apiTools.Api(sendToSupervisor)
api.setCredentials('dummySandboxSupervisorCredentials')
log = api.log

var supervisor_buffer = ""
var stdin = process.openStdin()
stdin.on('data', function(chunk) {
	supervisor_buffer += chunk
	var delim = supervisor_buffer.indexOf(String.fromCharCode(10))
	while(delim != -1) {
		msg = JSON.parse(supervisor_buffer.slice(0,delim), remotingTools.micromud_json_parse)
		onSupervisorMessage(msg)
		supervisor_buffer = supervisor_buffer.slice(delim+1)
		delim = supervisor_buffer.indexOf(String.fromCharCode(10))
	}
})

sendToSupervisor({op:'online'})
sendToSupervisor({op:'ready'})

var sandboxFiber;
function syncify(async_fun) {
	return function() {
		var new_args = Array();
		for(var i=0;i<arguments.length;i++) {
			new_args.push(arguments[i]);
		}
		new_args.push(function(v) {
			sandboxFiber.run(v);
		});
		async_fun.apply(this, new_args)
		return Fiber.yield()
	}
}
var sApi = api.mapOperations(syncify);

function MudObjectProxyHandler(obj) {	
	if(typeof(obj) == "undefined") {
		obj = sApi.create();
	}
	return {
		get:function(receiver, name) {
			return sApi.get(obj, name)
		},
		set:function(receiver, name, val) {
			return sApi.set(obj, name, val)
		},
		getOwnPropertyDescriptor:function(name) {
			return "todo_gopd"
		},
	}
}

function MudObject() {
	return Proxy.create(MudObjectProxyHandler())
}

var standardScriptFiles = ["ObjectProxy.js"]
standardCode = ""
for(var i=0; i<standardScriptFiles.length;i++) {
//	standardCode += fs.readFileSync("jsSandboxLib/"+standardScriptFiles[i])
}
standardCode += "var ret_val = eval(jsCode);"
var standardScript = vm.createScript(standardCode,'virtual/standardScript.vm')
function onSupervisorMessage(msg) {
	if(msg.op == 'request') {
		sandboxFiber = Fiber(function(start) {
			standardScript.runInNewContext(sandbox)
		});
		sandbox = {api:api,sApi:sApi,MudObject:MudObject}
		sandbox.random = Math.random
		sandbox.jsCode = msg.request.code
		api.setCredentials(msg.request.ctx)
		log(sandbox.jsCode)
		sandboxFiber.run()
		var requestUid = msg.request.requestUid
		if(requestUid != undefined) {
			ret_val = sandbox.ret_val
			api.satisfy(requestUid, ret_val, function() {})
		}
		else {
			api.log("GOT NO UID")
		}
	}
	else if(msg.op == 'apiFeed') {
		api.feed(msg.request)
	}
	else {
		if(typeof(op) !== 'undefined') {
			log("Unknown request type "+op)
			log(JSON.stringify(msg))
		}
		else {
			log("Sandbox received request without an op specified.")
		}
	}
};

setInterval(function() {
	sendToSupervisor({op:'ready'})
}, 10)
