var remotable_types = {}

function register_remotable_type(name, handler) {
	remotable_types[name] = handler
}


function RemoteMudObject(data) {
	this.uid = data.uid
	this.toString = function() {
		return "MudObject #"+this.uid
	}
	this.inspect = function() {
		return "MudObject #"+this.uid
	}
	this.toJSON = function() {
		return {
			'___type':'RemoteMudObject',
			'uid':this.uid,
		} 
	}
}
register_remotable_type("MudObject", RemoteMudObject)


function apply_mud_type(value) {
	if(typeof(value) !== 'undefined' && typeof(value.___type) !== 'undefined') {
		var obj = new remotable_types[value.___type](value)
		return obj
	}
	else {
		return value
	}
}

function micromud_json_parse(key, value) {
	return apply_mud_type(value);
}

exports.apply_mud_type = apply_mud_type
exports.micromud_json_parse = micromud_json_parse
exports.register_remotable_type = register_remotable_type
