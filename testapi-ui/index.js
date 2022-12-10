const express = require('express');
const Web3 = require('web3');
const solc = require('solc');
require('dotenv').config()
const app = express()
const cors = require('cors')
var bodyParser = require('body-parser')
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.MAINNET));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));
app.use(cors())

app.get("/", (req, res)=>{
    res.status(200).send({
        message : "hello world"
    })
})

app.post("/address", async (req, res)=>{
    const myContract = req.body.con;
    var a = performance.now();
    const web3 = new Web3(new Web3.providers.HttpProvider(process.env.GOERLI));

    let firstIndexContract = myContract.indexOf("contract");
    const findContractName = (contract, firstIndex) =>{
        let contractName = "";
        let i = firstIndex + 9;
        let stop = true;
        while (stop){
            if (contract[i] !== " "){
                contractName += contract[i];
            }
            else{
                stop = false;
            }
            i += 1;
        }
        return contractName;
    }

    const name = findContractName(myContract, firstIndexContract)

    const input = {
    language: 'Solidity',
    sources: {
            'Incrementer.sol': {
                content: myContract
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
    const contractFile = tempFile.contracts['Incrementer.sol'][name];

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
    var b = performance.now();
    
    console.log('Execution time:', ((b - a)/1000), 'seconds');
    timet = (b - a)/1000;

    return res.status(200).send({
        error : false,
        contract : myContract,
        bytecode : bytecode,
        time : timet,
        address : createReceipt.contractAddress
    });  
})

app.listen(3000, ()=>{
    console.log("server is running at port 3000");
})