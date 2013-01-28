var tcpApi = require('./lib/tcpApi.js');


api = tcpApi.TcpApi(9949, function() {
	api.setCredentials({
		obj:'b440ad7e-4f9e-459e-9d3e-99f1aff7a036',
		'secret':'test90210'
	})
})

function sandboxed_fun() {
	// async style
	api.create(function(turnip) {
		api.set(turnip, "name", "Kevin", function() {
			api.get(turnip, "name", function(val) {
				api.log("The turnip is named "+val+".");
			})
		})
	})
	// sync style
	var cat = sApi.create()
	sApi.set(cat, "name", "Mr. Meowsers")
	sApi.set(cat, "color", "red")
	var color = sApi.get(cat,"color")
	api.log("The cat is "+color+".")
	//proxy style
	var dog = MudObject()
	api.log("Created dog.")
	dog.name="Buddy"
	dog.color='blenheim'
	api.log("The dog is "+dog.color+".")
	// and save all our hard work
	api.dump()
}

api.runJs("("+sandboxed_fun.toString()+")()", function(msg) {
	console.log("Ran")
});
