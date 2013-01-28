var remotingTools = require('./jsSandboxLib/remotingTools.js')
var uuid = require('node-uuid')
var net = require('net')
var child_process = require('child_process')
var fs = require('fs')

var OutstandingRequests = function() {
	this.client_requests = {}
	this.register = function(result_cb) {
		var request_uid = uuid.v4();
		this.client_requests[request_uid] = result_cb
		return request_uid;
	}
	this.feed = function(msg) {
		this.client_requests[msg.requestUid](msg.val)
	}
}
var outstanding_requests = new OutstandingRequests()


var objects = {}

var opHandlers = {}

function notBlank(x) { }
function accessibleObj(obj) { }
function accessibleObjKey(obj, key) {
	accessibleObj(obj)
	//objects[msg.obj][msg.key].lock_get
}

MudObjectPrototype = {}
MudObjectPrototype.inspect = function() {
	return "#"+this.uid
}
MudObjectPrototype.toString = function()
{
	return "#" + this.uid;
}
MudObjectPrototype.getReference = function() {
	return {
		'___type':'MudObject',
		'uid':this.uid
	}
}
 
function MudObject(uid) 
{
	this.uid = uid
}
MudObject.prototype = MudObjectPrototype
remotingTools.register_remotable_type("RemoteMudObject", MudObject)


function server_json_encode(key, value) {
	if(typeof(value) !== 'undefined' && typeof(value.getReference) !== 'undefined') {
		return value.getReference()
	}
	else {
		return value
	}
}


function ensureMudObj(obj, key) {
	if(typeof(objects[obj][key]) == 'undefined') {
		var uid = uuid.v4();
		objects[obj][key] = new MudObject(uid)
	}
}

opHandlers.getObjectByUid = function(client, msg, cb) {
	accessibleObj(msg.obj)
	var obj = objects[msg.obj]
	cb({val:obj})
}
opHandlers.get = function(client, msg, cb) {
	accessibleObjKey(msg.obj, msg.key)
	var attr = objects[msg.obj][msg.key];
	if(typeof(attr.lock_get) !== 'undefined') {
		javascript_sandbox_requests.receive({code:attr.lock_get}, "CTXTODO", function(result) {
			if(result == true) {
				cb({val:attr.val})
			}
			else {
				cb({error:"Can't access attribute."})
			}
		})
	}
	else {
		cb({val:attr.val})
	}
}
opHandlers.call = function(client, msg, cb) {
	new_sandbox_ctx = get_context_for_obj(msg.obj)
	javascript_sandbox_requests.receive(raw_val, get_context_for_obj(msg.obj))
}
opHandlers.satisfy = function(client, msg, cb) {
	outstanding_requests.feed(msg)
}
opHandlers.lockSetAttr = function(client, msg, cb) {
	accessibleObjKey(msg.obj, msg.key)
	ensureMudObj(msg.obj, msg.key)
	notBlank(msg.val)
	objects[msg.obj][msg.key].lock_set = msg.val
	cb({})
}
opHandlers.lockGetAttr = function(client, msg, cb) {
	accessibleObjKey(msg.obj, msg.key)
	ensureMudObj(msg.obj, msg.key)
	notBlank(msg.val)
	objects[msg.obj][msg.key].lock_get = msg.val
	cb({})
}
opHandlers.set = function(client, msg, cb) {
	accessibleObjKey(msg.obj, msg.key)
	notBlank(msg.val)
	ensureMudObj(msg.obj, msg.key)
	objects[msg.obj][msg.key].val = msg.val
	cb({})
}
opHandlers.move = function(client, msg, cb) {
	accessibleObjKey(msg.obj,'location')
	notBlank(msg.val)
	objects[msg.obj].location = val
}
opHandlers.log = function(client, msg, cb) {
	console.log(msg.txt)
}
opHandlers.getAllObjectKeys = function(client, msg, cb) {
	cb({keys:Object.keys(objects)})
}
opHandlers.getKeys = function(client, msg, cb) {
	accessibleObj(msg.obj)
	cb({keys:Object.keys(objects[msg.obj])})
}
opHandlers.dump = function(client, msg, cb) {
	if(1==1) {
		fs.writeFile('objects.json', JSON.stringify(objects), 'utf8');
	}
	else {
		cb({op:'dumpResponse',error:'You are not allowed to dump the database to disk.'})
	}
}
opHandlers.runJs = function(client, msg, cb) {
	notBlank(msg.code)
	javascript_sandbox_requests.receive(msg, "CTXTODO", function(result) {
		cb({val:result})
	})
}
opHandlers.create = function(client, msg, cb) {
	var uid = uuid.v4();
	var obj = new MudObject(uid);
	objects[uid] = obj;
	cb({val:obj})
}

function handle_request(msg, client) {
	if(typeof(msg.op) !== 'undefined') {
		if(typeof(opHandlers[msg.op]) !== 'undefined') {
			if(typeof(msg.requestId) !== 'undefined') {
				cb = function(reply_msg) {
					reply_msg.op = 'response'
					reply_msg.requestId = msg.requestId
					client.jsonMsg(reply_msg)
				}
			}
			else {
				cb = function() {}
			}
			opHandlers[msg.op](client, msg, cb)
		}
		else {
			client.jsonMsg({'op':'error',txt:"You requested an unknown operation: "+msg.op})
		}
	}
	else {
		client.jsonMsg({'op':'error',txt:"Your request did not include an operation."})
	}
}

function receive_request(txt, client) {
	try {
		req = JSON.parse(txt, remotingTools.micromud_json_parse)
	}
	catch(e) {
		client.jsonMsg({
			op:'error',
			txt:'the request you sent was not valid JSON: '+txt,
		});
	}
	if(typeof(req) !== undefined) {
		handle_request(req, client)
	}
}
function SupervisoryContract(pool, getWorkerFun) {
	this.pool = pool
	this.worker = false
	this.worker_buf = ""
	var keepaliveCheck = function(sup) {
		if(sup.seenRecently) {
			sup.seenRecently = false
			setTimeout(function(sup) {
				return function() {
					keepaliveCheck(sup)
				}
			}(sup), 30)
		}
		else {
			console.log("Killing process thats MIA")
			sup.worker.kill('SIGKILL')	
		}
	}
	this.setNewWorker = function() {
		this.worker_buf = ""
		this.worker = getWorkerFun()
		this.worker.on('exit', function(contract) {
			return function(code, signal) {
				console.log("Worker ended")
				contract.setNewWorker()
			}
		}(this))
		this.worker.stdout.on('data', 
			function(sup) {
				return function(data) {
					sup.worker_buf += data
					sup.checkBuffForMessage()
				}
			}(this)
		)
		this.worker.stderr.on('data', 
			function(sup) {
				return function(data) {
					console.log("WORKR ERROR> "+data)
				}
			}(this)
		)
		function WorkerClient(worker) {
			this.uid = uuid.v4()
			this.worker = worker
			this.jsonMsg = function(msg) {
				var envelope = {
					op:'apiFeed',
					request:msg,
				}
				this.worker.stdin.write(JSON.stringify(envelope, server_json_encode)+String.fromCharCode(10))
			}
		}
		this.worker.client = new WorkerClient(this.worker)
	}
	this.checkBuffForMessage = function() {
		var delim = this.worker_buf.indexOf(String.fromCharCode(10))
		while(delim != -1) {
			msg = JSON.parse(this.worker_buf.slice(0,delim), remotingTools.micromud_json_parse)
			this.onMessage(msg)
			this.worker_buf = this.worker_buf.slice(delim+1)
			delim = this.worker_buf.indexOf(String.fromCharCode(10))
		}
	}
	this.onMessage = function(msg) {
		if(msg.op == 'online') {
			this.onOnline()
		}
		else if(msg.op == 'ready') {
			this.onReady()
		}
		else  {
			handle_request(msg, this.worker.client)
		}
	}
	this.send = function(msg) {
		this.worker.stdin.write(JSON.stringify(msg, server_json_encode)+String.fromCharCode(10))
	}
	this.setNewWorker()
	this.beginRequest = function(request) {
		this.seenRecently = true
		this.send({op:'request',request:request})
	}
	this.onReady = function() {
		this.seenRecently = true
		this.pool.addAvailableWorker(this)
	}
	this.onOnline = function() {
		this.seenRecently = true
		keepaliveCheck(this)
	}
	this.seenRecently = false
}
function RequestPool() {
	this.requests = []
	this.available_workers = []
	this.attemptDispatch = function() {
		if(this.available_workers.length > 0 && this.requests.length > 0) {
			var available_worker = this.available_workers.pop()
			var request = this.requests.pop()
			available_worker.beginRequest(request)
		}
	}
	this.receive = function(request, ctx, result_cb) {
		var result_request_uid = outstanding_requests.register(result_cb)
		request.requestUid = result_request_uid
		this.requests.push(request)
		this.attemptDispatch()
	}
	this.addAvailableWorker = function(worker) {
		this.available_workers.push(worker)
		this.attemptDispatch()
	}
	this.removeAvailableWorker = function(worker) {
		var idx = this.available_workers.indexOf(worker)
		this.available_workers.splice(idx,1)
	}
}
var javascript_sandbox_requests = new RequestPool()

var numCPUs = require('os').cpus().length;
for(var i=0; i < numCPUs; i++) {
	new SupervisoryContract(javascript_sandbox_requests, function() {
		return child_process.spawn('node',['--harmony-proxies','./services/jsSandbox/serviceWorker.js'])
	})
}

var server = net.createServer(function(client) {
	client.uid = uuid.v4();
	client.buffer = ""
	client.setEncoding('utf8')
	client.jsonMsg = function(msg) {
		client.write(JSON.stringify(msg, server_json_encode)+'\n')
	}
	client.on('data', function(data) {
		client.buffer += data
		var delim = this.buffer.indexOf(String.fromCharCode(10))
		while(delim != -1) {
			receive_request(client.buffer.slice(0,delim), client)
			this.buffer = this.buffer.slice(delim+1)
			delim = this.buffer.indexOf(String.fromCharCode(10))
		}
	})
})
server.listen(9949)
