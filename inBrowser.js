var exports;
var EC = require('elliptic').ec;
var ec = new EC('secp256k1');
exports.socket;
exports.xml = new XMLHttpRequest();
function stringToSiggy(string){
	sSplit = string.split("_");
	return {r: sSplit[0], s: sSplit[1]};
}
function siggyToString(siggy){
	return siggy.r.toString("hex") + "_" + siggy.s.toString("hex");
}
exports.generateWallet = function(){
let pair = ec.genKeyPair();
let pub = 'tnet_04' + pair.getPublic().getX().toString('hex') + pair.getPublic().getY().toString('hex');
let priv = pair.getPrivate().toString("hex");
document.getElementById('pubkey').value = pub;
document.getElementById('privkey').value = priv;
}
exports.linkSocket = function(endpoint){
	exports.socket = new WebSocket(endpoint);
	exports.socket.onmessage = function(msg){
		document.getElementById("output").innerHTML += msg.data + "<br>";
	}
}
exports.ls2 = function(){
	exports.linkSocket(document.getElementById("wsinput").value);
}
exports.getAddressData = function(address){
	exports.xml.open("POST", "http://tnetwork.ext.io:3367/", false);
	exports.xml.send(JSON.stringify([{action: "getBalance", address: document.getElementById("expAddress").value}]));
	document.getElementById("explore").innerHTML = "";
	document.getElementById("explore").innerHTML+="Balance: " + exports.xml.responseText;
}
module.exports = exports;
