const express = require('express');
const solc = require('solc');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const Web3 = require('web3');
const axios = require('axios');
const flash = require('connect-flash');
const app = express()
const nodemailer = require('nodemailer');
require('dotenv').config()
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.MAINNET));
const PORT = 3000
const APIKEY = process.env.API_KEY

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));
app.use(flash())

let dbCon = mysql.createConnection({
    host : "localhost",
    user : "root",
    database : "report-node"
})
dbCon.connect()

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

// gas price
const getGas = async () =>{
    return web3.utils.fromWei(await web3.eth.getGasPrice() , 'gwei'); 
}

// main page
app.get("/", (req, res)=>{
    return res.status(200).send({
        error : false, 
        message : "Welcome to etherscan API",
        written_by : "Kongphop",
    });

})

// show database
app.get("/database/reports", (req, res)=>{
    dbCon.query('SELECT * FROM data', (error, results, fields)=>{
        if (error) throw error;

        let message = "";
        if (results === undefined || results.length === 0){
            message = "The reports is empth";
        }

        else {
            message = "Successfully retrieved all reports.";
        }

        return res.status(200).send({
            message : message,
            data : results,
        });
    })
})

// index page
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

    return res.status(200).send({
        error : false,
        latestBlock : block,
        blocks : blocks,
        transactions : transactionInBlock,
        gasPrice : gasPrice,
        d : d
    })
})

// show about address
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

// show about block number
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

// link to login page
app.get("/login", (req, res)=>{
    res.render("login")
})

// login module but dummy not auth
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

// send ether
app.post("/sendEther", async (req, res)=>{
    const addressTo = req.body.addressTo;
    const amountTo = req.body.amountTo;
    const web3 = new Web3(new Web3.providers.HttpProvider(process.env.GOERLI));

    const accountFrom = {
        privateKey: process.env.PRIVATEKEYB,
        address: process.env.PUBLICKKEYB,
    };

    console.log(`Attempting to send transaction from ${accountFrom.address} to ${addressTo}`);

    const createTransaction = await web3.eth.accounts.signTransaction(
        {
            gas: 21000,
            to: addressTo,
            value: web3.utils.toWei(amountTo, 'ether'),
        },
        accountFrom.privateKey
    );

    const createReceipt = await web3.eth.sendSignedTransaction(createTransaction.rawTransaction);
    console.log(`Transaction successful with hash: ${createReceipt.transactionHash}`);

    return res.status(200).send({
        address : addressTo,
        amount : amountTo,
        hash : await createReceipt.transactionHash
    });
})

app.get("/contract", (req, res)=>{
    return res.status(200).send({emssage : "contract page"});
})

app.get("/deployPage", (req, res)=>{
    return res.status(200).send({emssage : "deploy page"});
})

// send report to problem
app.post('/problem', (req, res)=>{
    const email = req.body.email;
    const problem = req.body.problem;

    // validation before set to database
    if(!email || !problem){
        return res.status(400).send({
            error : true, 
            message : "Please provide email or problem."
        });
    }

    // set data to database
    else{
        dbCon.query("INSERT INTO data (email, problem) VALUES(?, ?)", [email, problem], (error, results, fields)=>{
            if (error) throw error;

            return res.status(200).send({
                error : false, 
                data : results,  
                message : "we will reply as soon as possible."
            });
        });
    }
})

// delete problem by id
app.delete('/deleteProblem', (req, res)=>{
    const id = req.body.id;

    if (!id){
        return res.status(400).send({
            error : true,
            message : "Please provide problem id."
        });
    }

    else {
        dbCon.query("DELETE FROM data WHERE id = ?", [id], (error, results, fields)=>{
            if (error) throw error;

            let message = "";
            if (results.affectedRows === 0){
                message = "Problem not found."
            }

            else{
                message = "Problem successfully deleted."
            }

            return res.status(200).send({
                error : false,
                results : results,
                message : message
            });
        });
    }
})

// get id and email to reply
app.get("/reply/:email/:id", (req, res)=>{
    const email = req.params.email;
    const id = req.params.id;

    return res.status(200).send({
        email : email,
        id : id
    });
})

// replay to client
app.post("/replyToClient", (req, res)=>{
    const email = process.env.EMAIL;
    const password = process.env.PASSWORD;

    const message = req.body.message;
    const emailClient = req.body.emailClient;
    const id = req.body.id;

    const transporter = nodemailer.createTransport({
        service : 'gmail',
        auth : {
            user : process.env.EMAIL,
            pass : process.env.PASSWORD
        }
    });

    const mailOption = {
        from : process.env.EMAIL,
        to : emailClient,
        subject : `Reply the problem by admin`,
        text : message,
    };

    transporter.sendMail(mailOption, function(error, info){
        if(error){
            console.log(error);
        }

        else{
            console.log(`Email send : ${info.response}`);

            if (!id){
                return res.status(400).send({
                    error : true,
                    message : "Please provide problem id."
                });
            }
        
            else {
                dbCon.query("DELETE FROM data WHERE id = ?", [id], (error, results, fields)=>{
                    if (error) throw error;
        
                    let message = "";
                    if (results.affectedRows === 0){
                        message = "Problem not found."
                    }
        
                    else{
                        message = "Problem is replied"
                    }

                    return res.status(200).send({
                        email : email,
                        password : password,
                        message : message,
                        emailClient : emailClient,
                        id : id,
                        info : info.response,
                        message : message
                    });
                });
            }
        }
    });
})

// deploy contract 
app.post("/deployContract", async (req, res)=>{
    const myContract = req.body.con;
    const start = performance.now();
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
    const stop = performance.now();
    
    console.log('Execution time:', ((stop - start)/1000), 'seconds');
    timet = (stop - start)/1000;

    return res.status(200).send({
        error : false,
        time : timet,
        address : createReceipt.contractAddress
    });  
})

app.listen(PORT, ()=>{
    console.log(`Server is running port ${PORT}`);
})