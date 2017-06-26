'use strict';

const 
	https        = require('https'),
	crypto       = require('crypto'),
	events       = require('events'),
	qs           = require('querystring'),
	eventEmitter = new events.EventEmitter();

const
  ipn = require('./ipn.js');

module.exports = (function () {

	const 
    API_VERSION = 1,
    API_HOST    = 'www.coinpayments.net',
    API_PATH    = '/api.php';

	function CoinPayments({key=false, secret=false, autoIpn=false, ipnTime=30}){
		if (!key || !secret) {
      throw new Error('Missing public key and/or secret');
    }
    this.credentials   = { key, secret };
    this.config        = { autoIpn, ipnTime, isPolling: false };
    this._transactions = [];
    this._withdrawals = [];
    this._conversions = [];
	}

	CoinPayments.prototype = Object.create(eventEmitter);
	CoinPayments.prototype.constructor = CoinPayments;

  CoinPayments.events = eventEmitter
  CoinPayments.ipn = ipn.bind(eventEmitter);


	CoinPayments.prototype.getSettings = function({cmd=false}) {
    switch(cmd) {
    	case 'get_basic_info':
        return [];
      case 'get_tx_ids':
        return [];
      case 'get_deposit_address':
        return ['currency'];
      case 'get_callback_address':
        return ['currency'];
      case 'create_transfer':
        return ['amount', 'currency', 'merchant|pbntag'];
      case 'convert':
        return ['amount', 'from', 'to'];
      case 'get_withdrawal_history':
      	return [];
    	case 'get_conversion_info':
      	return ['id'];
    	case 'get_pbn_info':
    		return ['pbntag'];
    	case 'get_pbn_list':
    		return [];
  		case 'update_pbn_tag':
    		return ['tagid'];
  		case 'claim_pbn_tag':
    		return ['tagid', 'name'];
      case 'get_withdrawal_info':
        return ['id'];
      case 'get_tx_info':
        return ['txid'];
      case 'get_tx_info_multi':
        return ['txid'];
      case 'create_withdrawal':
        return ['amount', 'currency', 'address'];
      case 'create_mass_withdrawal':
        return [];
      case 'create_transaction':
        return ['amount', 'currency1', 'currency2'];
      case 'rates':
        return [];
      case 'balances':
        return [];
      default:
        return false;
    }
  }

  CoinPayments.prototype._registerTransaction = function ({txn_id}) {
  	this._transactions.push(txn_id);
  	if (!this.config.isPolling) return this._startPolling();
  }

  CoinPayments.prototype._startPolling = function () {
  	if (this.config.isPolling) return;
  	let setIntervalAndExecute = (fn) => {
  		this.config.isPolling = true;
  		fn();
  		return setInterval(fn, this.config.ipnTime * 1000);
  	}

  	let poll = () => {
  		if (!this._transactions.length) return this._stopPolling();
  		return this.getTxMulti(this._transactions, (err, result) => {
  			if (err) return console.warn("Polling Error...");
  			this.emit('autoipn', result);
  			for (let tx in result) {
  				if (result[tx].status < 0 || result[tx].status == 100 || result[tx].status == 1) {
  					this._transactions.splice(this._transactions.indexOf(tx), 1);
  				}
  			}
  			if (!this._transactions.length) return this._stopPolling();
  		});
  	}

  	this.loop = setIntervalAndExecute(poll);
  }

  CoinPayments.prototype._stopPolling = function () {
  	this.config.isPolling = false;
  	return clearInterval(this.loop);
  }

  CoinPayments.prototype._assert = function(obj, allowArray) {
    let flag = true;
    let msg = 'Missing options: ';
    for(let i = 0; i<allowArray.length; i++) {
    	let prop = allowArray[i].split('|');
    	prop = (prop.length == 1) ? prop[0] : prop;
    	if (typeof prop == 'string') {
    		if(!obj.hasOwnProperty(allowArray[i])) {
	        flag = false;
	        msg += allowArray[i] + ', ';
	      }		
    	} else {
    		flag = false;
    		let temp = msg;
    		for(let j = 0; j<prop.length; j++) {
    			if (obj.hasOwnProperty(prop[j])) {
    				flag = true;
    			} else {
    				temp += prop[j] + ', ';
    			}
    		}
    		msg = (!flag) ? msg : temp;
    	}
    }
    return (flag) ? null : msg;
  }

	CoinPayments.prototype._getPrivateHeaders = function (parameters) {
    let paramString, signature;

    parameters.key = this.credentials.key;
    paramString = qs.stringify(parameters);
    signature = crypto.createHmac('sha512', this.credentials.secret).update(paramString).digest('hex');
    return {
    	'Content-Type': 'application/x-www-form-urlencoded',
      'HMAC': signature
    };
	}

  CoinPayments.prototype.request = function(parameters, callback) {

    let reqs = this.getSettings(parameters);
    if(!reqs) return callback(new Error('No such method ' + parameters.cmd));

    let assert = this._assert(parameters, reqs);
    if(assert) return callback(new Error(assert));
    parameters.version = API_VERSION;

    let options = {
      method: 'POST',
      host: API_HOST,
      path: API_PATH,
      headers: this._getPrivateHeaders(parameters)
    };

    let query = qs.stringify(parameters);
    let req = https.request(options, (res) => {
      let data = '';

      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        data = JSON.parse(data);
        if(data.error != 'ok') return callback(data.result);
        if (this.config.autoIpn && parameters.cmd == 'create_transaction') {
        	this._registerTransaction(data.result);
        }
        return callback(null, data.result);
      });
    });
    req.on('error', callback);
    req.write(query);
    req.end();
  }

  CoinPayments.prototype.createTransaction = function(options, callback) {
    options.cmd = 'create_transaction';
    return this.request(options, callback); 
  }

  CoinPayments.prototype.rates = function(options, callback) {
  	if (typeof options == 'function') {
  		callback = options;
  		options = {};
  	}
    options.cmd = 'rates';
    return this.request(options, callback);
  }

  CoinPayments.prototype.balances = function(options, callback) {
  	if (typeof options == 'function') {
  		callback = options;
  		options = {};
  	}
    options.cmd = 'balances';
    return this.request(options, callback);
  }

  CoinPayments.prototype.createWithdrawal = function(options, callback) {
    options.cmd = 'create_withdrawal';
    options.auto_confirm = 1;
    return this.request(options, callback);
  }

  CoinPayments.prototype.createMassWithdrawal = function(withdrawalArray, callback) {
    let options = {};
    withdrawalArray.filter(function (w) {
      return w.currency && w.amount && w.address
    }).forEach(function (w, index) {
      options[`wd[wd${index + 1}][amount]`] = w.amount;
      options[`wd[wd${index + 1}][address]`] = w.address;
      options[`wd[wd${index + 1}][currency]`] = w.currency;
    });
    if (!Object.keys(options).length) return callback(null, []);
    options.cmd = 'create_mass_withdrawal';
    return this.request(options, callback);
  }

  CoinPayments.prototype.getTx = function(txid, callback) {
  	let options = {txid, cmd: 'get_tx_info'};
    return this.request(options, callback);
  }

  CoinPayments.prototype.getWithdrawalInfo = function(id, callback) {
  	let options = {id, cmd: 'get_withdrawal_info'};
    return this.request(options, callback);
  }

  CoinPayments.prototype.getTxMulti = function(tx_id_array, callback) {
  	let options = {txid: tx_id_array.join("|"), cmd: 'get_tx_info_multi'};
    return this.request(options, callback);
  }
  CoinPayments.prototype.getTxList = function(options, callback) {
    if (typeof options == 'function') {
      callback = options;
      options = {};
    }
    options.cmd = 'get_tx_ids';
    return this.request(options, callback);
  }
  
  CoinPayments.prototype.getBasicInfo = function(callback) {
    let options = { cmd: 'get_basic_info' };
    return this.request(options, callback);
  }

  CoinPayments.prototype.getDepositAddress = function(currency, callback) {
    let options = { currency, cmd: 'get_deposit_address' };
    return this.request(options, callback);
  }
  CoinPayments.prototype.getCallbackAddress = function (currency, callback) {
  	let options = { currency, cmd: 'get_callback_address' };
    return this.request(options, callback);	
  }
  CoinPayments.prototype.createTransfer = function (options, callback) {
  	options.cmd = 'create_transfer';
    options.auto_confirm = 1;
    return this.request(options, callback);	
  }

  CoinPayments.prototype.convertCoins = function (options, callback) {
  	options.cmd = 'convert';
    return this.request(options, callback);
  }

  CoinPayments.prototype.getWithdrawalHistory = function (options, callback) {
  	if (typeof options == 'function') {
  		callback = options;
  		options = {};
  	}
  	options.cmd = 'get_withdrawal_history';
    return this.request(options, callback);	
  }

  CoinPayments.prototype.getConversionInfo = function(id, callback) {
  	let options = {id, cmd: 'get_conversion_info'};
    return this.request(options, callback);
  }

  CoinPayments.prototype.getProfile = function(pbntag, callback) {
  	let options = {pbntag, cmd: 'get_pbn_info'};
    return this.request(options, callback);
  }

	CoinPayments.prototype.tagList = function(callback) {
  	let options = { cmd: 'get_pbn_list' };
    return this.request(options, callback);
  }  

  CoinPayments.prototype.updateTagProfile = function(options, callback) {
  	options.cmd = 'update_pbn_tag' ;
    return this.request(options, callback);
  }

  CoinPayments.prototype.claimTag = function(options, callback) {
  	options.cmd = 'claim_pbn_tag' ;
    return this.request(options, callback);
  }

  return CoinPayments; 

})();


