const cp = require('child_process');
cp.exec("npm install request public-ip big-integer ws js-hash-code", handleStart);
const fs = require('fs');
const request = require('request');
var startPeer = "http://198.12.71.184:3367/";
function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min) ) + min;
}
function replaceFile(i, rNode, address){
	console.log("requested file: " + address + " " + rNode + " " + i);
	request({url: rNode, method: "POST", body: JSON.stringify([{action: "requestFileContents", "address": address, fileName: String(i)}])}, function (err, res, bod){
		fs.writeFile("./ledger/" + address + "/" + String(i) + ".json", bod, function(){});
		console.log("Replaced file " + i + " for address " + address + "; File orginating from node" + rNode);
	});
}
function replaceHistory(address, nodeList, numTrans){
	console.log("Initialized file restoration for address " + address);
	for (let i=0; i<numTrans; i++){
		let rNode = nodeList[getRndInteger(0, nodeList.length)];
		setTimeout(function(){replaceFile(i, rNode, address)}, 150 * (i+1)); 	
	}
}
function loadPointers(nodeList, numPointers, startIndex){
	if (startIndex == null) {
		startIndex = 0;
	}
	for (let i=startIndex; i<=numPointers; i++){
		let rNode = nodeList[getRndInteger(0, nodeList.length)];
		setTimeout(function(){replacePointer(rNode, i)}, 700 * (i+1)); 	
	}
	
		setTimeout(function(){
			function recursiveCompile(currIndex, lastIndex, addyList, callback){
				fs.readFile("./transactionLog/" + currIndex + ".json", function(err, rez){
					console.log(err, rez);
					rez = JSON.parse(rez);
					if (!addyList.includes(rez["to"])){
						addyList.push(rez["to"]);
					}
					if (!addyList.includes(rez["from"])){
						addyList.push(rez["from"]);
					}
					if (currIndex != lastIndex-1){
						recursiveCompile(currIndex+1, lastIndex, addyList, callback);
					}
					else{
						callback(addyList);
					}
				});
			}
			recursiveCompile(startIndex, numPointers, [], function(list){
				for (let i=0; i<list.length; i++){
					let item = list[i];
					var calculatedTime = 0;
					request({url: startPeer, method: "POST", body: JSON.stringify([{action: "requestFileContents", address: item, fileName: "balance"}])}, function (err, res, bod){
						if (!fs.existsSync("./ledger/" + item)){
							fs.mkdirSync("./ledger/" + item);
						}
						fs.writeFileSync("./ledger/" + item + "/balance.json", bod);
						let numT = JSON.parse(bod)["lastCount"];
						setTimeout(function(){replaceHistory(item, [startPeer], numT);}, calculatedTime);
						calculatedTime+=(150 * numT);
					});
				}
			});
		}, 700 * (numPointers+1));
	
}
function replacePointer(rNode, pointer){
	request({url: rNode, method: "POST", body: JSON.stringify([{action: "getTransactionPointer", "pointer": pointer}])}, function (err, res, bod){
		fs.writeFile("./transactionLog/" + String(pointer) + ".json", bod, function(){});
		console.log("Replaced  pointer" + pointer + "; File orginating from node" + rNode);
	});
}
function handleStart(){
	if (fs.existsSync("./ledger/") && fs.existsSync("./internalData/") && fs.existsSync("./transactionLog/")){
		console.log('updating');
		update();
	}
	else{
		console.log('syncing new version');
		sync();
	}
}
function update(){
	let myLastTransaction = Number(fs.readFileSync("./internalData/transactionCount.json"));
	request({url: startPeer, method: "POST", body: JSON.stringify([{action: "getTransactionCount"}])}, function(err, res, bod){
		fs.writeFileSync("./internalData/transactionCount.json", bod);
		bod = Number(bod);
		loadPointers([startPeer], bod, myLastTransaction);
	});
}
function sync(){
	fs.mkdirSync("./ledger");
	fs.mkdirSync("./internalData");
	fs.mkdirSync("./transactionLog");

request({url: startPeer, method: "POST", body: JSON.stringify([{action: "getTransactionCount"}])}, function (err, res, bod){
	fs.writeFileSync("./internalData/transactionCount.json", bod);
	loadPointers([startPeer], Number(bod));
});	
request({url: startPeer, method: "POST", body: JSON.stringify([{action: "getAddressList"}])}, function (err, res, bod){
	console.log(bod);
	aList = JSON.parse(bod);
	var calculatedTime = 0;
	for (let i=0; i<aList.length; i++){
		let item = aList[i];
		fs.mkdirSync("./ledger/" + item);
		request({url: startPeer, method: "POST", body: JSON.stringify([{action: "requestFileContents", address: item, fileName: "balance"}])}, function (err, res, bod){
			fs.writeFileSync("./ledger/" + item + "/balance.json", bod);
			let numT = JSON.parse(bod)["lastCount"];
			setTimeout(function(){replaceHistory(item, [startPeer], numT);}, calculatedTime);
			calculatedTime+=(150 * numT);
		});
	}
	setTimeout(function(){
		request({url: startPeer, method: "POST", body: JSON.stringify([{action: "getTransactionCount"}])}, function (err, res, bod){
			fs.writeFileSync("./internalData/transactionCount.json", bod);
		});	
	}, calculatedTime);
});	
}
