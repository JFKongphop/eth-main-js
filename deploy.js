const fs = require('fs');
const solc = require('solc');
const Web3 = require('web3');
require('dotenv').config()

const myContract = `
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract Incrementer {
    uint256 public number;

    constructor(uint256 _initialNumber) {
        number = _initialNumber;
    }

    function increment(uint256 _value) public {
        number = number + _value;
    }

    function reset() public {
        number = 0;
    }
}
`

const deploy = async () => {
    var a = performance.now();
    const web3 = new Web3(new Web3.providers.HttpProvider(process.env.GOERLI));

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
    var b = performance.now();
    
    console.log('Execution time:', ((b - a)/1000), 'seconds')
};

deploy();