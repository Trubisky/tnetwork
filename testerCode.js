const fs = require('fs-extra');
const hash = require('js-hash-code');
const rsa = require('./RSAChain.js');
const request = require('request');
const bn = require('big-integer');
function isValid(proof, key, data){
	console.log(bn(Math.abs(nHash(data))).value);
	console.log(rsa.decryptNumber(proof, key[1], key[2]).value);
	if (bn(Math.abs(nHash(data))).value == rsa.decryptNumber(proof, key[1], key[2]).value){
		return true;
	}
	else{
		return false;
	}
}
function nHash(input){
	return parseInt(hash(input), 16);
}
function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min) ) + min;
}
function broadcastOutput(output){
	console.log(output);
	/*(for (socket of wss.clients){
		try{
			socket.send(output);
		}
		catch(e){}
	}
	*/
}
function replaceFile(i, rNode, address){
	broadcastOutput("requested file: " + address + " " + rNode + " " + i);
	request({url: rNode, method: "POST", body: JSON.stringify([{action: "requestFileContents", "address": address, fileName: String(i)}])}, function (err, res, bod){
		fs.writeFile("./ledger/" + address + "_temp/" + String(i) + ".json", bod, function(){});
		broadcastOutput("Replaced file " + i + " for address " + address + "; File orginating from node" + rNode);
	});
}
function replaceHistory(address, nodeList, numTrans){
	broadcastOutput("Initialized file restoration for address " + address);
	for (let i=0; i<numTrans; i++){
		let rNode = nodeList[getRndInteger(0, nodeList.length)];
		setTimeout(function(){replaceFile(i, rNode, address)}, 400 * (i+1)); 
	}
	setTimeout(function(){
		finalizeReplacement(address, function(result){
			if (!result){
				console.log('fake data');
				fs.emptyDir("./ledger/" + address + "_temp", function(err){
					fs.rmdirSync("./ledger/" + address + "_temp");
				});
			}
			else{
				console.log('real data');
				fs.emptyDir("./ledger/" + address, function(err){
					fs.rmdirSync("./ledger/" + address);
					fs.renameSync("./ledger/" + address + "_temp/", "./ledger/" + address + "/");
				});
			}
		});
	}, (400*numTrans) + 500);
	//NEED TO WIPE CONSENSUSOBJECT LISTING HERE FOR MEMORY ALLOCATION
	//given an array of the nodes with tthe correct majority data and address,
	//replace all data files for trnasation history with correct recrds
	//10/31/18
}
function finalizeReplacement(address, callback){
	fs.readFile("./ledger/" + address +"_temp/balance.json", function(err,res){
		let count = JSON.parse(res)["lastCount"];
		checkFile(0, count);
	});
	function checkFile(num, endNum){
		fs.readFile("./ledger/" + address + "_temp/" + num + ".json", function(err, res){
			let fileContents = JSON.parse(res);
			let adsplit = fileContents[0]["from"].split("_");
			let valid = isValid(fileContents[1], adsplit, fileContents[0]);
			if (valid && num != (endNum-1)){
				checkFile(num+1, endNum);
			}
			else if(valid && num == (endNum-1)){
				callback(true);
			}
			else{
				callback(false);
			}
		});
	}
}
let address2 = "tnet_421530091_60108680248339";
request({url: "http://198.12.71.184:3367/", method: "POST", body: JSON.stringify([{action: "requestFileContents", "address": address2, fileName: "balance"}])}, function (err, res, bod){
				let nList = ["http://198.12.71.184:3367/"];
				fs.mkdirSync("./ledger/" + address2 + "_temp/");
				fs.writeFile('./ledger/' + address2 + "_temp/balance.json", bod, function(r){});
				replaceHistory(address2, nList, JSON.parse(bod)["lastCount"]);

			});
