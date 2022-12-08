const express = require('express');
const solc = require('solc');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const Web3 = require('web3');
const axios = require('axios');
const flash = require('connect-flash');
const app = express()
require('dotenv').config()
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.MAINNET));
const PORT = 3000
const APIKEY = process.env.API_KEY

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));
app.use(flash())

class GetDataAPI{
    constructor(address, apiKey){
        this.address = address;
        this.apiKey = apiKey;

    }

    getDataAddress = async () =>{
        let addressData = []
        let API = `https://api.etherscan.io/api?module=account&action=txlist&address=${this.address}&startblock=0&endblock=99999999&page=1&offset=10&sort=asc&apikey=${this.apiKey}&fbclid`
        const response = await axios.get(API);
        const transactions = response.data.result;
        transactions.map((tx)=>{
            addressData.push({
                blockNumber : tx.blockNumber,
                hash : tx.hash,
                from : tx.from,
                to : tx.to
            })
        })

        return addressData;
    }
}

const getTokenTotalSupply = async (address, apiKey) =>{
    let API = `https://api.etherscan.io/api?module=stats&action=tokensupply&contractaddress=${address}&apikey=${apiKey}`;
    const response = await axios.get(API);
    const value = +web3.utils.fromWei(response.data.result , 'mwei');
    const totalSupply = value.toLocaleString('en-US');
    
    if (totalSupply !== "0"){
        return totalSupply
    }

    return "Not token address"
    
}

const getGas = async () =>{
    return web3.utils.fromWei(await web3.eth.getGasPrice() , 'gwei'); 
}

app.get("/", (req, res)=>{
    return res.status(200).send({
        error : false, 
        message : "Welcome to etherscan API",
        written_by : "Kongphop",
    });
})

app.get("/index", async (req, res)=>{
    let blocks = []
    const block = await web3.eth.getBlockNumber();
    for (let blockNumber = block; blockNumber > block - 15; blockNumber--) {
        blocks.push(blockNumber)
    }

    const insideBlock = await web3.eth.getBlock(block);
    const transactionInBlock = insideBlock.transactions.splice(0, 15)

    const d = Date.now();
    const gasPrice = getGas()

    return res.status(400).send({
        error : false,
        latestBlock : block,
        blocks : blocks,
        transactions : transactionInBlock,
        gasPrice : gasPrice,
        d : d
    })
})

app.post("/address", async (req, res)=>{
    let address = req.body.address;

    if (address.length > 0 && address.length < 11){
        const block = await web3.eth.getBlock(address);

        return res.status(200).send({
            error : false,
            block : block
        });
    }

    else if (address.length > 50){
        const transaction = await web3.eth.getTransaction(address);
        const value = web3.utils.fromWei(transaction.value , 'ether');

        return res.status(200).send({
            error : false,
            transaction : transaction,
            value : value
        });
    }

    try{
        address = web3.utils.toChecksumAddress(address);
    }
    catch {
        flash('message', "Invalid address");
        return res.redirect("/");
    }

    const amount = await web3.eth.getBalance(address);
    const balance = web3.utils.fromWei(amount, 'ether');
    const totalSupply = await getTokenTotalSupply(address, APIKEY);
    const totalTransactions = await new GetDataAPI(address, APIKEY).getDataAddress()

    return res.status(200).send({
        error : false,
        address : address,
        balance : balance,
        totalSupply : totalSupply,
        totalTransactions : totalTransactions
    })
})

app.get("/block/:blockNumber", async (req, res)=>{
    let blockNumber = req.params.blockNumber;
    const block = await web3.eth.getBlock(blockNumber);

    return res.status(200).send({
        error : false,
        block : block
    })
})

app.get("/transaction/:hash", async (req, res)=>{
    let hash = req.params.hash;

    const transaction = await web3.eth.getTransaction(hash);
    const value = web3.utils.fromWei(transaction.value , 'ether');
    const gasPrice = getGas()


    return res.status(200).send({
        error : false,
        transaction : transaction,
        value : value,
        gasPrice : gasPrice
    });
})

app.get("/login", (req, res)=>{
    res.render("login")
})

app.post("/loginAdmin", (req, res)=>{
    const email = req.body.email;
    const password = req.body.password;

    if (!email || !password){
        return res.status(400).send({
            error : true,
            message : "Invalid email or password, please login again"
        })
    }

    if (email === process.env.EMAIL && password === process.env.PASSWORDD){
        return res.status(200).send({
            error : false,
            message : "Welcome admin",
            token : "Access admin page"
        })
    }

    else{
        return res.status(401).send({
            error : true,
            message : "Unauthorized, only admin"
        })
    }
})

app.post("/deployContract", async (req, res)=>{
    const contract = req.body.contract;

    let a = performance.now();
    const web3 = new Web3(new Web3.providers.HttpProvider(process.env.GOERLI));

    const input = {
    language: 'Solidity',
    sources: {
            'Incrementer.sol': {
                content: contract
            },
    },
    settings: {
            outputSelection: {
                '*': {
                    '*': ['*'],
                },
            },
    },
    };

    const tempFile = JSON.parse(solc.compile(JSON.stringify(input)));
    const contractFile = tempFile.contracts['Incrementer.sol']['Incrementer'];

    const accountFrom = {
        privateKey: process.env.PRIVATEKEY,
        address: process.env.PUBLICADDRESS,
    };

    const bytecode = contractFile.evm.bytecode.object;
    const abi = contractFile.abi;
    console.log(`Attempting to deploy from account ${accountFrom.address}`);

    const incrementer = new web3.eth.Contract(abi);
    const incrementerTx = incrementer.deploy({
        data: bytecode,
        arguments: [5],
    });

    const createTransaction = await web3.eth.accounts.signTransaction(
        {
            data: incrementerTx.encodeABI(),
            gas: await incrementerTx.estimateGas(),
        },
        accountFrom.privateKey
    );

    const createReceipt = await web3.eth.sendSignedTransaction(createTransaction.rawTransaction);
    console.log(`Contract deployed at address: ${createReceipt.contractAddress}`);
    let b = performance.now();
    
    console.log('Execution time:', ((b - a)/1000), 'seconds')
    const time = (b - a)/1000

    return res.status(200).send({
        time : time, 
        address : createReceipt.contractAddress
    })
})

app.listen(PORT, ()=>{
    console.log(`Server is running port ${PORT}`);
})