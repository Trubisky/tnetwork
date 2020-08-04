var request = require('request');
const publicIp = require('public-ip');
var EC = require('elliptic').ec;
var ec = new EC('secp256k1');
const bn = require('big-integer');
const fs = require('fs-extra');
const ws = require('ws');
const wss = new ws.Server({port: 3366});
const hash = require('js-hash-code');
var activeNodes = [];
var lastCount = -1;
var consensusObject = {};
/*
Functions converted to async:
returnHash
returnTransactionCount
returnFileData
*/
console.log(generateWallet())
function nHash(input){
	return parseInt(hash(input), 16);
}
function broadcastOutput(output){
	console.log(output);
	for (socket of wss.clients){
		try{
			socket.send(output);
		}
		catch(e){}
	}
}
function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min) ) + min;
}
broadcastOutput(generateSignedTransaction({action: "transaction", from: "tnet_04610b554bdb7f6620c264c8f8be9e9b004e6dca614a76e37ffa4bc8dfedb79e91b73374b0f26ac660feae5134d854a633471e37563408cfa14a45f0a9afede2ee", to: "tnet_04bb9abd5c07091a5c00cc1990eec255241b63bfcbef5b57b130cf3352aa829b7f591553dfb10071259ce18d5a4362259641d6e9c2ba0c2a70c9d7ee4819a7dc68", value: 1, nonce: 3}, "6a6bed5cfb7b340ad51bf8dcc42439f45df86573962d36c8df385c942c7b5811"));
var port = 3367;
var myip;
var http = require('http');
const startPeer = "";
//broadcastOutput(generateWallet());
//p2p communication protocal is an http POST api on port 3367
var pubNode = http.createServer(function (req, res) {
	if (req.method == 'POST'){
		resBod = "";
	req.on('data', function(data){
		resBod += data;
	});
	req.on('end', function(){
		let data = resBod;
		try{
			data = JSON.parse(data);
			switch(data[0]["action"]){
				case "transaction":
					getTransaction(data, function(r){
						res.write(r);
						res.end();
					})
					break;
				case "getAddressList":
					fs.readdir("./ledger", function(err, r){
						res.write(JSON.stringify(r));
						res.end();
					});
					break;
				case "getTransactionCount":
					returnTransactionCount(function(c){
						res.write(c);
						res.end();
					});
					break;
				case "generateSignedTransaction":
					res.write(generateSignedTransaction(data[0]["transaction"], data[0]["privateKey"]));
					res.end();
					break;
				case "getTransactionPointer":
					returnTransactionPointer(data[0]["pointer"], function(r){
						res.write(r);
						res.end();
					});
					break;
				case "getHash":
				case "requestConsensus":
					returnHash(data[0]["address"], function(myHash){
						res.write(myHash + "");
						res.end();
					});
					break;
				case "sendSignedTransaction":
					sendSignedTransaction(JSON.stringify(data[0]["transactionObject"]));
					res.write("Broadcasted");
					res.end();
					break;
				case "getBalance":
					getBalance(data[0]["address"], function(b){
						res.write(b + "");
						res.end();
					});
					break;
				case "requestFileContents":
					returnFileData(data[0]["address"], data[0]["fileName"], function(r){
						//console.log(r);
						res.write(r);
						res.end();
					});
					break;
				case "peerConnect":
					request({url: data[0]["peer"], method: "POST", body: JSON.stringify([{action: "requestStatus"}])}, function (err, res, bod){
					if (!activeNodes.includes(data[0]["peer"]) && bod == "1"){
					activeNodes.push(data[0]["peer"]);
					}
					fixDuplicates();
					});
					res.end();
					break;
				case "getPeerList":
					res.write(JSON.stringify(activeNodes));
					res.end();
					break;
				case "requestStatus":
					res.write("1");
					res.end();
					break;
				case "generateWallet":
					res.write(JSON.stringify(generateWallet()));
					res.end();
					break;
				default:
					res.write("Invalid command");
					res.end();
			}
			broadcastOutput("POST data recieved: " + JSON.stringify(data[0]));
		}
		catch(err){
			broadcastOutput(String(err));
			//res.end
		}
	});
	}
	else{
		res.end();
		broadcastOutput('Handled GET request.');
	}
}).listen(port); 
publicIp.v4().then(ip => {
	lastCount = fs.readFileSync("./internalData/transactionCount.json");
    myip = ip;
	let ipString = "http://" + myip + ":3367/";
	//add self to nodelist in order to broadcast transactions to oneself without extra steps
	activeNodes.push(ipString);
	if (startPeer != ""){
		//If there's a listed startpeer, it means there's a network. No startpeer will create a new network running in local mode - it's only implemented for solo testing pre release
		request({url: startPeer, method: "POST", body: JSON.stringify([{action: "getPeerList"}])}, function (err, res, bod){
			bod = JSON.parse(bod);
			syncNodes(bod);		
			for (item of bod){
				request({url: item, method: "POST", body: JSON.stringify([{action: "peerConnect", peer: ipString}])}, function (err, res, bod){
					broadcastOutput("Successfully broadcasted connection to node " + item);
				}); 
			}
		}); 
	}
	//activeNodes.push(startPeer);
	//Node initialization functions here
	
});
//return the hash from the balance record 
function syncNodes(list){
	for (item of list){
		if (!activeNodes.includes(item) && !item.includes("localhost")){
			activeNodes.push(item);
		}
	}
}
function syncNodesLocal(){
	let timer = 100;
	for (itemx of activeNodes){
		let lItem = itemx;
		setTimeout(function(){test(lItem)}, timer);
		timer+=150;
	}
	function test(item){
		request({url: item, method: "POST", body: JSON.stringify([{action: "requestStatus"}])}, function (err, res, bod){
			if (err){
				activeNodes = rebuild(activeNodes(item));
			}
		}); 
	}
}
function fixDuplicates(){
	let localRecord = [];
	for (item of activeNodes){
		if (!localRecord.includes(item)){
			localRecord.push(item);
		}
	}
	activeNodes = localRecord;
}
function returnHash(address, callback){
	try{
	fs.readFile("./ledger/" + address + "/balance.json", function(err, data){
		if (err) {callback("Invalid request");}
		else{
			callback(JSON.parse(data)["lastHash"]);
		}
	});
	}
	catch (err){
	broadcastOutput(err);
	callback("Error - Invalid Request");
	}
}
function returnFileData(address, record, callback){
	/*
	for this format, just set record to the name. The .json extention will be added automatically
	*/
	try{
    fs.readFile("./ledger/" + address + "/" + record + ".json", function(err, data){
		if (err) {callback("Invalid request")}
		else{
			callback(data);
		}
	});
	}
	catch (err){
	broadcastOutput(err);
	callback("Error - invalid request");
	}
}
function returnTransactionPointer(number, callback){
	//Will work with a string or number as input I believe
	fs.readFile("./transactionLog/" + number + ".json", function(err, data){
		if (err){callback("Invalid request")}
		else{callback(data)}
	});
}
function returnTransactionCount(callback){
	 fs.readFile("./internalData/transactionCount.json", function(err, res){
		 if (err) {callback("Invalid request")}
		 else{callback(res)}
	 });
}
/*
the below function is used after a transaction to gether the consensus hash from other nodes
called after the node processes a transaction
partway done
*/
function confirmData(address, mode){
	
	//name of table is consensusObject
	//mode 0 is consensus initialization
	//mode 1 is final process
	if (mode == 0){
		broadcastOutput("Started confirmation phase 1 for address " + address);
		let nodelist;
		if (activeNodes.length <= 10){
		nodelist = activeNodes;
		}
		else{
		nodelist = [];
		let tempNodeList = activeNodes.slice(0);
		//compile list of 10 random nodes
		for (i=1; i<=10; i++){
			let selected = tempNodeList[getRndInteger(0, tempNodeList.length)];
			nodelist.push(selected);
			tempNodeList = rebuild(tempNodeList, selected);
		}
		}
		broadcastOutput("Selected nodes to confirm with: ");
		broadcastOutput(JSON.stringify(nodelist));
		consensusObject[address] = {};
		let body2 = JSON.stringify([{action: "requestConsensus", "address": address}]);
		//request the hash of the address of 10 other random nodes in the network
		for (node of nodelist){
			let local = node;
			request({url: local, method: "POST", body: body2}, function (err, res, bod){		
					if (consensusObject[address][bod] == null){
						consensusObject[address][bod] = [];
					}
					consensusObject[address][bod].push(local);
					broadcastOutput("recieved response from node " + local + " with resulting hash " + bod);			
			}); 
		}
		setTimeout(function(){confirmData(address, 1);}, 7000);
		
		//at this point nodelist contains up to 10 differet nodes, randomly selected
		;
		//draw 10 random nodes
		//ask for hashes for the address from the 10 different nodes
		//at this point implement http endpoint for address confirmation
		
	}
	else if(mode == 1){
		broadcastOutput("Started confirmation phase 2 for address " + address);
		//at this point consensusObject[address] has an object populated with keys of each respective hash 
		let largestValue = 0;
		let consensusHash;
		for (key in consensusObject[address]){
			if (consensusObject[address][key].length > largestValue){
				largestValue = consensusObject[address][key].length;
			}
		}
		for (key in consensusObject[address]){
			if (consensusObject[address][key].length == largestValue){
				consensusHash = key;
			}
		}
		broadcastOutput("Consensus hash: " + consensusHash);
		returnHash(address, function(myHash){
		broadcastOutput("Local hash: " + myHash);
		if (myHash != consensusHash){
			broadcastOutput('Local hash != Consensus hash; initializing data restoration');
			//you need some shit here to resolve the issues 
			let randA = consensusObject[address][consensusHash][getRndInteger(0, consensusObject[address][consensusHash].length)];
			let balanceDat;
			request({url: randA, method: "POST", body: JSON.stringify([{action: "requestFileContents", "address": address, fileName: "balance"}])}, function (err, res, bod){
				balanceDat = bod;
				/*
				
				THIS IS WHERE YOU LEFT OFF 10/30/18 - IT REQUESTS THE BALANCE OF THE ADDTRESS FROM A TRUSTED NODE, AND RETURNS THE CORRECT BALANCE + #. Write this data over the balance file
				
				*/
				let nList = consensusObject[address][consensusHash].slice(0);
				fs.mkdirSync("./ledger/" + address + "_temp/");
				fs.writeFile('./ledger/' + address + "_temp/balance.json", balanceDat, function(r){});
				replaceHistory(address, nList, JSON.parse(balanceDat)["lastCount"]);
				consensusObject[address] = null;
			});
		}
		});
		//at this point consensusHash is the majority hash value returned from the post requests 
		//figure out your own hash at this point and if it's different refresh the wallet database
		
		//The current method of recording concensus nodes (con sensusObject, counting in keypairs) needs to be redone so the count is actually an array of the correct nodes
		//Update 10/30/18: Done; the list of results is now an array of the nodes returning the results, so the correct ones can be drawn
		//then a node out of consensus 
	}
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
		setTimeout(function(){replaceFile(i, rNode, address)}, 350 * (i+1)); 
	}
	setTimeout(function(){
		finalizeReplacement(address, function(result){
			if (!result){
				fs.emptyDir("./ledger/" + address + "_temp", function(err){
					fs.rmdirSync("./ledger/" + address + "_temp");
				});
			}
			else{
				fs.emptyDir("./ledger/" + address, function(err){
					fs.rmdirSync("./ledger/" + address);
					fs.renameSync("./ledger/" + address + "_temp/", "./ledger/" + address + "/");
				});
			}
		});
	}, (350*numTrans) + 500);
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

function stringToSiggy(string){
	sSplit = string.split("_");
	return {r: sSplit[0], s: sSplit[1]};
}
function siggyToString(siggy){
	return siggy.r.toString("hex") + "_" + siggy.s.toString("hex");
}
function getTransaction(data, callback){
	/*
	transaction format
	json object
	action: transaction
	from: user's address from
	to: address to send to
	signature: the proofofowner number
	value: amount to send
	nonce: number of transactions
	*/
	try{
		let proofOfOwner = data[1];
		let to = data[0]["to"];
		let value = data[0]["value"];
		let address = data[0]["from"];
		let adsplit = address.split("_");
		let given_nonce = data[0]["nonce"];
		returnFileData(address, "balance", function(result){
		getBalance(address, function(finalBal){
		try{
		let accepted_nonce = JSON.parse(result)["lastCount"];
		if (given_nonce != accepted_nonce){
			throw "Invalid nonce";
		}
		broadcastOutput('Initialized transaction request from supposed address ' + address);
		if (!fs.existsSync("./ledger/" + address + "/")){
			broadcastOutput(address);
			throw "Invalid address; No funds found";
		}
		let valid = isValid(proofOfOwner, adsplit, data[0]);
		/*
		You left off on switching the structure of a transaction
		structure is a JSON string array
		[ transaction object, transaction signature ]
		signature is the absolute value of the nHash, encoded with the private key
		everything should be correctly switched, just needs to be tested 
		
		This funciton is meant to process a transaction sent to the network.
		How it works:
		assuming the transaction is declared valid and both addresses are valid:
		
		if the reciever has no open account, it's opened on each node independently
		the balance is subtracted from sender and added to reciever
		the transaction is recorded under both of their accounts under a transaction nonce
		the hash of the last transaction hash, + the new transaction + the new balance is calculated and saved over the last hash
		therefore if the balance is ever changed or any transactions are edited the current hash will be wrong and out of consensus
		*/
		if (!valid){
			throw "Unauthenticated";
		}
		let balanceData = result;
		balanceData = JSON.parse(balanceData);
	//	broadcastOutput(balanceData["balance"]);
	//	broadcastOutput(value);
		if (finalBal >= value && value > 0){
			if (!to.includes("tnet") || !to.includes("_") || to.length < 10){
				throw "Invalid receiver address";
			}
			if (!fs.existsSync("./ledger/" + to + "/")){
				openAddressHistory(to);
			}
			balanceData2 = fs.readFileSync("./ledger/"+to+"/balance.json");
			balanceData2 = JSON.parse(balanceData2);
			lastCount++;
			data[2] = lastCount + "";
			fs.writeFile("./ledger/"+address+"/" + String(balanceData["lastCount"]) + ".json", JSON.stringify(data), function(r){});
			fs.writeFile("./ledger/"+to+"/" + String(balanceData2["lastCount"]) + ".json", JSON.stringify(data), function(r){});
			balanceData["lastHash"] = nHash(String(balanceData["lastHash"]) + JSON.stringify(data));
			balanceData2["lastHash"] = nHash(String(balanceData2["lastHash"]) + JSON.stringify(data));
			balanceData["lastCount"]++;
			balanceData2["lastCount"]++;
			fs.writeFile("./ledger/"+address+"/balance.json", JSON.stringify(balanceData), function(r){});
			fs.writeFile("./ledger/"+to+"/balance.json", JSON.stringify(balanceData2), function(r){});	
			var transactionRecord = {"from": address, "to":to, fromNonce: balanceData["lastCount"]-1, toNonce: balanceData2["lastCount"]-1};
			fs.writeFile("./transactionLog/" + lastCount + ".json", JSON.stringify(transactionRecord), function(r){});
			fs.writeFileSync("./internalData/transactionCount.json", lastCount);	
			broadcastOutput('done');
			confirmData(to, 0);
			callback("success");
			//setTimeout here for a consensus process on the transaction, to resolve discrepancies with other copies of the shared ledger
			//consensus prototal in progress
		}
		else{
			throw "Insufficient funds";
		}
		}
		catch(err){
			broadcastOutput(err);
			callback(err);
		}

		});
		});
	}
	catch(err){
		broadcastOutput(err);
		callback(err);
	}
}
/*
grabs a keypair from the RSA module and formats the public and private key correctly for use in tNet. returns a 2 item array with public, then private. 
public contains the tnet prefix, private doesn't
*/
function rebuild(array, value){
	let n = [];
	for (item of array){
		if (item != value){
			n.push(item);
		}
	}
	return n;
} //Tested and working 1/24/19
function generateWallet(){
let pair = ec.genKeyPair();
let pub = 'tnet_04' + pair.getPublic().getX().toString('hex') + pair.getPublic().getY().toString('hex');
let priv = pair.getPrivate().toString("hex");
return [pub, priv];	
}
/*
Returns a JSON string from a transaction object (non string) containing the transaction and the signed proof
the signed proof is the absolute value of the nHash of the transaction object, encrypted with the private key
*/
function generateSignedTransaction(trans, privkey){
	privkey = ec.keyFromPrivate(privkey, 'hex');
	let finalobject = [];
	finalobject[0] = trans;
	finalobject[1] = Math.abs(nHash(trans));
	finalobject[1] = siggyToString(ec.sign(finalobject[1], privkey));
	return JSON.stringify(finalobject);
}
function sendSignedTransaction(signedString){
	for (node of activeNodes){
		request({url: node, method: "POST", body: signedString}, function (err, res, bod){
			//this is the action for broadcasting a transactin
			//you need to have a way to connect peers in the format : "http://ip:port/ into the activeNodes array
			//consensus mechanism also needed
			
			//Something needs to be in the transaction module in order to rebroadcast transactions that may not have entirely completed. 
		}); 
	}
}
/*
opens a new ledger for a specified address
generally used for creating a record for an address that has not previously recieved funds.
*/
function openAddressHistory(address){
	fs.mkdirSync("./ledger/" + address);
	let startData = JSON.stringify({lastHash: 0, lastCount: 0});
	fs.writeFileSync("./ledger/" + address + "/balance.json", startData);
}
function isValid(proof, key, data){
	key = ec.keyFromPublic(key[1], 'hex');
	proof = stringToSiggy(proof);
	console.log(proof);
	console.log(key);
	data = Math.abs(nHash(data));
	if (ec.verify(data, proof, key)){
		return true;
	}
	else{
		return false;
	}
}
function getBalance(address, callback){ 
fs.readFile("./ledger/" + address + "/balance.json", function(err, res){
	if (err) {callback(err); return;}
	let data = JSON.parse(res)["lastCount"];
	calibrateBalance(0, data, 0);
});
function calibrateBalance(index, termpoint, balance){
	fs.readFile("./ledger/" + address + "/" + index + ".json", function(err, res){
		if (err) {callback(err); return;}		
	    resultData = JSON.parse(res)[0];
		if (resultData["from"].toLowerCase() == address){
			balance-=resultData["value"];
		}
		else{
			balance+=resultData["value"];
		}
		if (index == termpoint-1){
			callback(balance);
		}
		else{
			calibrateBalance(index+1, termpoint, balance);
		}
	});
	}
}
broadcastOutput("Node online.");
//openAddressHistory("tnet_497929837_4517460627005141");
//structure for address: tNet_publicKey_Modulo
//proofOfOwner is absolute value of the message hash, encoded