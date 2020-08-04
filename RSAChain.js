const bn = require('big-integer');
var exports = module.exports = {};
function gcd(a,b){
	let t=0;
	while(b!=0){
		t = a;
		a = b;
		b = t%b;
	}
	return a;
}
function getRnd(min, max) {
    return Math.floor(Math.random() * (max - min) ) + min;
}
function getPrime(min, max){
	for (i = getRnd(min, max) - Math.floor((max-min)/4); i<=max; i++){
		if (bn(i).isProbablePrime()){
			return i;
		}
	}
}
function isPrime(num) {
	res = true;
  for (i=2; i<Math.floor(num/2); i++){
	  if (num % i == 0){
		  res = false;
		  break;
	  }
  }
  return res;
}

function generateKeyPair(){
let publicKey = [739,15137];
let privateKey = [21539,1517];
let num1 = getPrime(10000000, 90000000);
let num2 = getPrime(10000000, 90000000);
nvalue = num1 * num2;
publicKey[1] = nvalue;
privateKey[1] = nvalue;
let eulers = (num1-1)*(num2-1);
let temp = determineNonFactors(eulers);
publicKey[0] = temp;
console.log(publicKey[0]);
console.log(eulers);
privateKey[0] = bn(publicKey[0]).modInv(eulers);
console.log(privateKey[0]);
ahash =245;
sig = bn(ahash).modPow(privateKey[0], privateKey[1])   ;
sig = sig.modPow(publicKey[0],publicKey[1]);
console.log(bn(ahash));
console.log(sig);
privateKey[0] = Number(privateKey[0].toString());
if (sig.value == bn(ahash).value){
	return {pub: publicKey, priv: privateKey};
}
}
function determineNonFactors(number){
	for (r=Math.floor(Math.random() * 500000000)+200000000; r<=number/2; r++){
		if (gcd(r, number) == 1 && isPrime(r)){
			console.log(r);
			return r;
		}
	}

}
exports.getKeyPair = function(){
	while (true){
		try{
			return generateKeyPair();
		}
		catch(err){
			return exports.getKeyPair();
		}
	}
}
exports.encryptNumber = function(number, privateKey, modulo){
	return bn(number).modPow(privateKey, modulo);
};
exports.decryptNumber = function(number, publicKey, modulo){
	return bn(number).modPow(publicKey, modulo);
};







