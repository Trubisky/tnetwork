var request = require('request');
const publicIp = require('public-ip');
const rsa = require('./RSAChain.js');
const bn = require('big-integer');
const fs = require('fs');
const ws = require('ws');
const wss = new ws.Server({port: 3366});
const hash = require('js-hash-code');
var activeNodes = [];
var lastCount = -1;
var consensusObject = {};
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
broadcastOutput(generateSignedTransaction({action: "transaction", from: "tnet_489205919_111143915274923", to: "tnet_623342719_1871860311937799", value: 1.3, nonce: 9}, "105397411670495_111143915274923"));
var port = 3367;
var myip;
var http = require('http');
const startPeer = "http://198.12.71.184:3367/";
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
			//duh
			if (data[0]["action"] == "transaction"){
				let resx = getTransaction(data);
				res.write(resx);
				res.end();
				//res.end
			}
			else if(data[0]["action"] == "getAddressList"){
				res.write(JSON.stringify(fs.readdirSync("./ledger")));
				res.end();
			}
			else if(data[0]["action"] == "getTransactionCount"){
				res.write(returnTransactionCount());
				res.end();
			}
			else if(data[0]["action"] == "getTransactionPointer"){
				res.write(returnTransactionPointer(data[0]["pointer"]));
				res.end();
			}
			//returns the hash
			else if(data[0]["action"] == "getHash"){
				res.write(returnHash(data[0]["address"]) + "");
				res.end();
			}
			else if(data[0]["action"] == "requestConsensus"){
				res.write(returnHash(data[0]["address"]) + "");
				res.end();
			}
			else if(data[0]["action"] == "sendSignedTransaction"){
				sendSignedTransaction(JSON.stringify(data[0]["transactionObject"]));
				res.write("Broadcasted");
				res.end();
			}
			else if(data[0]["action"] == "requestFileContents"){
				/*
				Should be formatted as so:
				action: requestFileContents
				address: address
				fileName: duh (no JSON extention)
				*/
				res.write(returnFileData(data[0]["address"], data[0]["fileName"]));
				res.end();
			}
			else if(data[0]["action"] == "peerConnect"){
				request({url: data[0]["peer"], method: "POST", body: JSON.stringify([{action: "requestStatus"}])}, function (err, res, bod){
					if (!activeNodes.includes(data[0]["peer"]) && bod == "1"){
					activeNodes.push(data[0]["peer"]);
					}
					fixDuplicates();
				});
				res.end();
			}
			else if(data[0]["action"] == "getPeerList"){
				res.write(JSON.stringify(activeNodes));
				broadcastOutput(activeNodes);
				res.end();
			}
			else if(data[0]["action"] == "requestStatus"){
				res.write("1");
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
function returnHash(address){
	try{
	return JSON.parse(fs.readFileSync("./ledger/" + address + "/balance.json"))["lastHash"];
	}
	catch (err){
	broadcastOutput(err);
	return "Error - invalid request";
	}
}
function returnFileData(address, record){
	/*
	for this format, just set record to the name. The .json extention will be added automatically
	*/
	try{
	let data = fs.readFileSync("./ledger/" + address + "/" + record + ".json");
	return data;
	}
	catch (err){
	broadcastOutput(err);
	return "Error - invalid request";
	}
}
function returnTransactionPointer(number){
	//Will work with a string or number as input I believe
	try{
		let data = fs.readFileSync("./transactionLog/" + number + ".json");
		return data;
	}
	catch(err){
		return "Invalid request";
	}
}
function returnTransactionCount(){
	return fs.readFileSync("./internalData/transactionCount.json");
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
		let myHash = returnHash(address);
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
				fs.writeFileSync('./ledger/' + address + "/balance.json", balanceDat);
				replaceHistory(address, consensusObject[address][consensusHash], JSON.parse(balanceDat)["lastCount"]);
			});
		}
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
		fs.writeFile("./ledger/" + address + "/" + String(i) + ".json", bod, function(){});
		broadcastOutput("Replaced file " + i + " for address " + address + "; File orginating from node" + rNode);
	});
}
function replaceHistory(address, nodeList, numTrans){
	broadcastOutput("Initialized file restoration for address " + address);
	for (let i=0; i<numTrans; i++){
		let rNode = nodeList[getRndInteger(0, nodeList.length)];
		setTimeout(function(){replaceFile(i, rNode, address)}, 700 * (i+1)); 
		
	}
	//NEED TO WIPE CONSENSUSOBJECT LISTING HERE FOR MEMORY ALLOCATION
	//given an array of the nodes with tthe correct majority data and address,
	//replace all data files for trnasation history with correct recrds
	//10/31/18
}

function getTransaction(data){
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
		let accepted_nonce = JSON.parse(returnFileData(address, "balance"))["lastCount"];
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
		let balanceData = fs.readFileSync("./ledger/"+address+"/balance.json");
		balanceData = JSON.parse(balanceData);
		broadcastOutput(balanceData["balance"]);
		broadcastOutput(value);
		if (balanceData["balance"] >= value){
			if (!to.includes("tnet") || !to.includes("_") || to.length < 10){
				throw "Invalid receiver address";
			}
			if (!fs.existsSync("./ledger/" + to + "/")){
				openAddressHistory(to);
			}
			balanceData2 = fs.readFileSync("./ledger/"+to+"/balance.json");
			balanceData2 = JSON.parse(balanceData2);
			balanceData["balance"]-=value;
			balanceData2["balance"]+=value;
			fs.writeFileSync("./ledger/"+address+"/" + String(balanceData["lastCount"]) + ".json", JSON.stringify(data));
			fs.writeFileSync("./ledger/"+to+"/" + String(balanceData2["lastCount"]) + ".json", JSON.stringify(data));
			balanceData["lastHash"] = nHash(String(balanceData["lastHash"]) + JSON.stringify(data) + balanceData["balance"]);
			balanceData2["lastHash"] = nHash(String(balanceData2["lastHash"]) + JSON.stringify(data) + balanceData2["balance"]);
			balanceData["lastCount"]++;
			balanceData2["lastCount"]++;
			fs.writeFileSync("./ledger/"+address+"/balance.json", JSON.stringify(balanceData));
			fs.writeFileSync("./ledger/"+to+"/balance.json", JSON.stringify(balanceData2));	
			var transactionRecord = {"from": address, "to":to, fromNonce: balanceData["lastCount"], toNonce: balanceData2["lastCount"]};
			fs.writeFileSync("./transactionLog/" + lastCount + ".json", JSON.stringify(transactionRecord));
			lastCount++;
			fs.writeFileSync("./internalData/transactionCount.json", lastCount);
			//setTimeout here for a consensus process on the transaction, to resolve discrepancies with other copies of the shared ledger
			//consensus prototal in progress
		}
		else{
			throw "Insufficient funds";
		}
		broadcastOutput('done');
		confirmData(to, 0);
		return "success";
	}
	catch(err){
		broadcastOutput(err);
		return err;
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
let pair = rsa.getKeyPair();
let pub = "tnet_" + pair.pub[0] + "_" + pair.pub[1];
let priv = pair.priv[0] + "_" + pair.priv[1];
return [pub, priv];	
}
/*
Returns a JSON string from a transaction object (non string) containing the transaction and the signed proof
the signed proof is the absolute value of the nHash of the transaction object, encrypted with the private key
*/
function generateSignedTransaction(trans, privkey){
	let finalobject = [];
	finalobject[0] = trans;
	finalobject[1] = Math.abs(nHash(trans));
	finalobject[1] = rsa.encryptNumber(finalobject[1], privkey.split("_")[0], privkey.split("_")[1]);
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
	let startData = JSON.stringify({balance: 0, lastHash: 0, lastCount: 0});
	fs.writeFileSync("./ledger/" + address + "/balance.json", startData);
}
function isValid(proof, key, data){
	if (bn(Math.abs(nHash(data))).value == rsa.decryptNumber(proof, key[1], key[2]).value){
		return true;
	}
	else{
		return false;
	}
}
broadcastOutput("Node online.");
//openAddressHistory("tnet_497929837_4517460627005141");
//structure for address: tNet_publicKey_Modulo
//proofOfOwner is absolute value of the message hash, encoded