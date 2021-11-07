export default {
	async getINR() {
		const response = await fetch("https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=INR");

		const { INR } = await response.json();

		return INR;
	}
};
