import Contract from "web3-eth-contract";
import Web3WsProvider from "web3-providers-ws";
import abi from "../abi.json";

Contract.setProvider(
	new Web3WsProvider(
		"wss://speedy-nodes-nyc.moralis.io/fe314106582b64c4547fb8c2/bsc/testnet/ws"
	)
);

const ocean = (window.ocean = new Contract(
	abi,
	"0xffBB015a2FEf271a412BEeF5541a766dc8BC6275"
));

export { ocean };
