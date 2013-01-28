var net = require('net')
var express = require('express');
var deferred = require('deferred')
var querystring = require('querystring');
var apiTools = require('../../jsSandboxLib/apiTools.js')

var app = express()

var client = net.connect(9949, function() {})
client.worker_buf = ""
client.jsonWrite = function(msg) {
	client.write(JSON.stringify(msg)+String.fromCharCode(10))
}

var api = apiTools.Api(client.jsonWrite)
api.setCredentials({obj:'b440ad7e-4f9e-459e-9d3e-99f1aff7a036','secret':'test90210'})

client.on('data', function(data) {
	client.worker_buf += data
	var delim = this.worker_buf.indexOf(String.fromCharCode(10))
	while(delim != -1) {
		msg = JSON.parse(client.worker_buf.slice(0,delim))
		api.feed(msg)
		this.worker_buf = this.worker_buf.slice(delim+1)
		delim = this.worker_buf.indexOf(String.fromCharCode(10))
	}
})

app.get('/', function(req, res) {
	var x = "";
	api.getAllObjectKeys(function(msg) {
		object_keys = msg.keys
		x += "<div>"+object_keys.length+" objects</div>";
		for(var i in object_keys) {
			x += "<div><a href='/inspect?"+querystring.stringify({obj:object_keys[i]})+"'>"+object_keys[i]+"</a></div>";
		}
		res.send(x)
	})
});

app.get('/inspect', function(req, res) {
	var obj = req.query['obj'];
	function getAndZip(obj, key, cb) {
		api.get(obj, key, function(val) {
			cb([key,val])
		})
	}
	var promisifiedGetKeys = deferred.promisify(api.getKeys)
	var promisifiedGetAndZip = deferred.promisify(getAndZip)
	var keyval_promise = promisifiedGetKeys(obj).map(function(key) {
		return promisifiedGetAndZip(obj,key)
	})
	var dummy_promise = promisifiedGetKeys(obj).map(function(key) {
		return promisifiedGetAndZip(obj,key)
	})
	deferred(keyval_promise, dummy_promise).end(function(result) {
		var keyval_results = result[0]
		var x = ""
		x += "<table>"
		for(var i=0;i<keyval_results.length;i++) {
			var key = keyval_results[i][0]
			var val = keyval_results[i][1]
			x += "<tr><td>"+key+"</td><td>"+JSON.stringify(val)+"</td></tr>"
		}
		
		x+= "</table>";
		res.send(x)
	})
		//w("<table>");
	//w("<h2>Exits</h2>");
/*
	for(var i in obj.contents) {
		var exit = objects[i];
		if(typeof(exit) == 'undefined') {
			desc = "broken link: "+i;
		}
		else {
			var desc;
			if(typeof(exit.Direction) == 'undefined') {
				if(typeof(exit.Name) == 'undefined') {
					desc = JSON.stringify(exit);
				}
				else {
					desc = exit.Name;
				}
			}
			else {
				desc = exit.Direction;
			}
		}
		if(typeof(exit.ToRoom) == 'undefined') {
			dest_desc = "dead end exit?"
		}
		else {
			dst = objects[exit.ToRoom]
			dest_desc = "<a href='/inspect?"+querystring.stringify({obj:exit.ToRoom})+"'>"+dst.Name+"</a>"
		}
		x += "<tr><td><a href='/inspect?"+querystring.stringify({obj:i})+"'>"+desc+"</a></td><td>"+dest_desc+"</td></tr>";
	}
	x += "</table>";
	var seen = {}
	draw_relative(obj, seen, 0, 0, 0)
	x += "<div style='position:relative;left:300px;top:300px;'>"
	zIndex = 200;
	for(var key in seen) {
		var room_obj = objects[key]
		var offset = seen[key]
		if(room_obj == obj) {
			room_style = 'background-color:yellow;'
			onclick = ""
		}
		else {
			room_style = 'background-color:white;'
			onclick = " onclick=\"window.location = '/inspect?obj="+key+"'\""
		}
		x += "<div style='z-index:"+zIndex+";float:left;position:absolute;left:"+(offset.x*128)+"px;width:128px;height:128px;border:1px solid black;"+room_style+"top:"+(offset.y*128)+"px' "+onclick+">"+room_obj.Name
		//x += "("+offset.x+","+offset.y+")"
		x += "</div>"
		zIndex++
	}
	x += "</div>"
*/
});

app.get('/create', function(req, res) {
	api.create(function(obj) {
		res.send(obj);
	})
});

app.get('/get', function(req, res) {
	var obj = objects[req.query['obj']];
	var key = req.query['key'];
	res.send(obj[key]);
});

app.get('/set', function(req, res) {
	var obj = req.query['obj'];
	var key = req.query['key'];
	var val = req.query['val'];
	api.set(obj, key, val, function() {})
	res.send("1");
});

app.get('/move', function(req, res) {
	var obj_id = req.query['obj'];
	var obj = objects[obj_id];
	var dest_id = req.query['destination'];
	dest_obj = objects[dest_id];
	obj.location = dest_id;
	if(typeof(obj.location) !== 'undefined') {
		var cur_container = objects[obj.location];
		delete cur_container.contents[obj_id];
	}
	dest_obj.contents[obj_id] = 1;
	res.send("1");
});


app.get('/dump', function(req, res) {
	api.dump(function() {
		res.send("Done.");
	})
});

app.get('/runjs', function(req, res) {
	javascript_sandbox_requests.receive(req.query['code'])
	res.send("Done.");
});

return app.listen(1982)
