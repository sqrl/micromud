import json
from time import sleep

def sendToSupervsior(obj):
	print json.dumps(obj)
	
sendToSupervsior({"op":"ready"})
sendToSupervsior({"op":"online"})

sendToSupervsior({"op":"log","txt":"Python sandbox going to sleep for a very long time."})
sleep(1000000000)

sendToSupervsior({"op":"log","txt":"Python sandbox done."})
