var net = require('net')
var apiTools = require('../jsSandboxLib/apiTools.js')
var remotingTools = require('../jsSandboxLib/remotingTools.js')

var TcpApi = function(connection_def, connected_cb) {
	var client = net.connect(connection_def, connected_cb)
	client.worker_buf = ""
	client.jsonWrite = function(msg) {
		client.write(JSON.stringify(msg, remotingTools.micromud_json_encode)+String.fromCharCode(10))
	}
	client.on('data', function(data) {
		client.worker_buf += data
		var delim = this.worker_buf.indexOf(String.fromCharCode(10))
		while(delim != -1) {
			msg = JSON.parse(client.worker_buf.slice(0,delim), remotingTools.micromud_json_parse)
			api.feed(msg)
			this.worker_buf = this.worker_buf.slice(delim+1)
			delim = this.worker_buf.indexOf(String.fromCharCode(10))
		}
	})

	var api = apiTools.Api(client.jsonWrite)
	return api
}

exports.TcpApi = TcpApi
