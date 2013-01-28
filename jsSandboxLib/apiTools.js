var outstanding_requests = {}

function opSatisfy(requestUid, val, cb) {
	apiWrite({op:'satisfy',requestUid:requestUid, val:val}, cb)
}
function opRunJs(code, cb) {
	apiWrite({op:'runJs',code:code,credentials:'TODO FROM sandboxutils'}, function(msg) {cb(msg)})
}
function opGetAllObjectKeys(cb) {
	apiWrite({op:'getAllObjectKeys'}, cb)
}
function opGetKeys(obj, cb) {
	apiWrite({op:'getKeys',obj:obj.uid}, function(msg) {cb(msg.keys)})
}
function opCreate(cb) {
	apiWrite({op:'create'}, function(msg) {cb(msg.val)})
}
function opDump(cb) {
	apiWrite({op:'dump'}, function(msg) {cb(msg.obj)})
}
function opGetObjectByUid(uid, cb) {
	apiWrite({op:'getObjectByUid',obj:uid}, function(msg) {cb(msg.val)})
}
function opGet(obj, key, cb) {
	apiWrite({op:'get',obj:obj.uid,key:key}, function(msg) {
		cb(msg.val)
	})
}
function opSet(obj, key, val, cb) {
	apiWrite({op:'set',obj:obj.uid,key:key,val:val}, function(msg) {cb(msg.val)})
}
function opLockSetAttr(obj, key, val, cb) {
	apiWrite({op:'lockSetAttr',obj:obj.uid,key:key,val:val}, function(msg) {cb(msg.val)})
}
function opLockGetAttr(obj, key, val, cb) {
	apiWrite({op:'lockGetAttr',obj:obj.uid,key:key,val:val}, function(msg) {cb(msg.val)})
}
function opLog(txt) {
	apiWrite({op:'log',txt:txt})
}
function opMove(obj,destination, cb) {
	apiWrite({op:'move',obj:obj.uid,destination:destination}, cb)
}

var apiOperations =  {
	lockSetAttr:opLockSetAttr,
	lockGetAttr:opLockGetAttr,
	create:opCreate,
	dump:opDump,
	get:opGet,
	getObjectByUid:opGetObjectByUid,
	set:opSet,
	move:opMove,
	getKeys:opGetKeys,
	log:opLog,
	getAllObjectKeys:opGetAllObjectKeys,
	runJs:opRunJs,
	satisfy:opSatisfy,
}

function apiMapOperations(fun) {
	var ret = {}; 
	for(key in apiOperations) {
		ret[key] = fun(apiOperations[key]);
	}
	return ret
}

function apiFeed(msg) {
	if(msg.requestId !== undefined) {
		if(outstanding_requests[msg.requestId]) {
			if(msg.error == undefined) {
				outstanding_requests[msg.requestId](msg)
			}
			else {
				// todo let funs register their own errbacks
				console.log("Error: "+msg.error)
			}
			delete(outstanding_requests[msg.requestId])
		}
	}
}

exports.Api = function(send_fun) {
	var requestId = 0
	var credentials;
	apiWrite = function(msg, cb) {
		if(credentials != undefined) {
			msg.credentials =credentials
		}
		if(cb) {
			msg.requestId = requestId
			outstanding_requests[requestId] = cb
			requestId++
		}
		send_fun(msg)
	}

	function apiSetCredentials(x) {
		credentials = x
	}	
		
	var api = {
		feed:apiFeed,
		setCredentials:apiSetCredentials,
		mapOperations:apiMapOperations,
		operations: apiOperations,
	}
	// flatten out the api a bit
	for(var key in apiOperations) {
		api[key] = apiOperations[key];
	}
	return api;
}
