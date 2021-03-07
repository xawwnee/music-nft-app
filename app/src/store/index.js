import url from 'url';
import Vue from 'vue';
import Vuex from 'vuex';
import Contract from 'web3-eth-contract';
import Web3WsProvider from 'web3-providers-ws';
import S3 from 'aws-sdk/clients/s3';
import abi from '../abi.json';


// Contract.setProvider(web3.currentProvider);
Contract.setProvider(new Web3WsProvider("wss://ropsten.infura.io/ws/v3/e0521fe0263543b79880ef251466bf33"));

const ocean = new Contract(abi, "0x80A0f2482c5BcB72fF39835Dd2EE90ADc0352946");

Vue.use(Vuex);

async function getCredentialsFromAccess(access_grant) {
    const storedCredentials = localStorage.getItem(`access:${access_grant}`);

    if(typeof storedCredentials === "string") {
        console.log("returning credentials from cache");
        return JSON.parse(storedCredentials);
    }

    const response = await fetch("https://auth.tardigradeshare.io/v1/access", {
        method: "POST",
        body: JSON.stringify({
            access_grant,
            public: false
        })
    });

    const {
        access_key_id,
        secret_key
    } = await response.json();

    const credentials = {
        accessKey: access_key_id,
        secretKey: secret_key
    };

    localStorage.setItem(`access:${access_grant}`, JSON.stringify(credentials));

    return credentials;
};

const urlCache = new Map();

async function getUrlFromStorjUri(uri) {
    if(urlCache.has(uri) === true) {
        return urlCache.get(uri);
    }

    const {auth, host, path} = url.parse(uri);
    console.log({auth, host, path});

    const {accessKey, secretKey} = await getCredentialsFromAccess(auth);
    console.log({accessKey, secretKey});

    const s3 = new S3({
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
        endpoint: "https://gateway.tardigradeshare.io",
        s3ForcePathStyle: true,
        signatureVersion: "v4"
    });

    const signedUrl = s3.getSignedUrl('getObject', {
        Bucket: host,
        Key: path.slice(1)
    });

    urlCache.set(uri, signedUrl);
    
    return signedUrl;
}

async function getRelease(releaseId) {
    const tokenId = Number(await ocean.methods.getTokenByRelease(releaseId, 0).call());
    console.log({ releaseId, tokenId });

    // e.g. sj://myaccess:mybucket/metadata.json
    const metadataUri = await ocean.methods.tokenURI(tokenId).call();
    console.log({metadataUri});

    // e.g. https://gateway.tardigradeshare.io/...
    const metadataUrl = await getUrlFromStorjUri(metadataUri);
    console.log({metadataUrl});

    // NFT metadata format
    const metadata = await (await fetch(metadataUrl)).json();
    console.log({metadata});

    // images are typically relative to metadata.json
    const imageUri = url.resolve(metadataUri, metadata.image);
    console.log({imageUri});

    const imageUrl = await getUrlFromStorjUri(imageUri);
    console.log({imageUrl});

    const release = {
        id: releaseId,
        name: metadata.name,
        artist: metadata.artist,
        tracks: metadata.tracks,
        imageUrl: imageUrl
    };

    // wait for image to load into browser cache
    await new Promise(resolve => {
        const preload = new Image();

        preload.onload = resolve;
        preload.src = release.imageUrl;
    });

    return release;
}

export default new Vuex.Store({
	state: {
		releases: [],
        releasesLoading: true
	},
	mutations: {
		pushRelease(state, release) {
			const releases = [
                ...state.releases,
                release
            ];

            state.releases = releases;
		},

        finishLoading(state) {
            state.releasesLoading = false;
        }
	},
	actions: {
		async getReleases({commit, state}) {
            await new Promise(r => setTimeout(r, 200));

            console.log(ocean);

            let totalReleases = Number(await ocean.methods.getReleaseSupply().call());

            const releaseIds = [];

            for(let i = 0; i < totalReleases; i++) {
                releaseIds.push(i);
            }

            const releases = await Promise.all(releaseIds.map(getRelease));

            for(const release of releases) {
                commit("pushRelease", release);
            }

            commit('finishLoading');
		}
	},
	modules: {
	}
});

