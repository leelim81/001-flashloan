require("dotenv").config();
const request = require('request');
const Web3 = require("web3");
const abis = require("./abis");
const { mainnet: addresses } = require("./addresses");
// const { testnet: addresses } = require("./addresses");  added for testing on testnet

//   *************** To run code without having contract deployed   Comment out line 9 and 33 to 37   *************************

const Flashloan = require("./build/contracts/FlashSwap.json");
const initialstateURL = `https://groker.init.st/api/events?accessKey=${process.env.INITIALSTATE_ACCESSKEY}&bucketKey=${process.env.INITIALSTATE_BUCKET}`;

const web3 = new Web3(
  new Web3.providers.WebsocketProvider(process.env.WSS_URL)
);
const { address: admin } = web3.eth.accounts.wallet.add(
  process.env.PRIVATE_KEY
);

const flashloanBUSD = "100";
const flashloanUSDT = "100"
const flashloanWBNB = "1";
const amountInBUSD = web3.utils.toBN(web3.utils.toWei(flashloanBUSD));
const amountInWBNB = web3.utils.toBN(web3.utils.toWei(flashloanWBNB));
const amountInUSDT = web3.utils.toBN(web3.utils.toWei(flashloanUSDT));
const pairsInfo =[
  {pair1: "BUSD" ,pair2: "WBNB" ,amount1: flashloanBUSD, address1: addresses.tokens.BUSD, amount2: flashloanWBNB, address2: addresses.tokens.WBNB},
  {pair1: "BUSD" ,pair2: "USDT" ,amount1: flashloanBUSD, address1: addresses.tokens.BUSD, amount2: flashloanUSDT, address2: addresses.tokens.USDT},
];
for (let i = 0; i < pairsInfo.length; i++) {
  pairsInfo[i].amountWei1 = web3.utils.toBN(web3.utils.toWei(pairsInfo[i].amount1));
  pairsInfo[i].amountWei2 = web3.utils.toBN(web3.utils.toWei(pairsInfo[i].amount2));
}

const ApeSwap = new web3.eth.Contract(
  abis.apeSwap.router,
  addresses.apeSwap.router
);

const PancakeSwap = new web3.eth.Contract(
  abis.pancakeSwap.router,
  addresses.pancakeSwap.router
);

const init = async () => {
  const networkId = await web3.eth.net.getId();
  //*************** To run code without having contract deployed   Comment out line 9 and 33 to 37   *************************
  const flashloan = new web3.eth.Contract(
    Flashloan.abi,
    Flashloan.networks[networkId]
  );

  web3.eth
    .subscribe("newBlockHeaders")
    .on("data", async (block) => {
      console.log(`New block received. Block # ${block.number}`);

      // BUSD/BNB
      // GetAmountsIn() you call this function to get figure out how BUSD you would need to get n BNB . 
      // GetAmountOut() will return how much BNB you would get for a give n BUSD.

      //here1 put the price into this fn
      async function getProfits(usdAmount, usdAddress, bnbAmount, bnbAddress) {
        try {
          const amountsOut1 = await ApeSwap.methods.getAmountsIn(usdAmount, [bnbAddress,usdAddress]).call();
          const amountsOut2 = await ApeSwap.methods.getAmountsOut(usdAmount,[usdAddress,bnbAddress]).call();
          const amountsOut3 = await PancakeSwap.methods.getAmountsIn(usdAmount,[bnbAddress,usdAddress]).call();
          const amountsOut4 = await PancakeSwap.methods.getAmountsOut(usdAmount,[usdAddress,bnbAddress]).call();
          const amountsOut5 = await ApeSwap.methods.getAmountsIn(bnbAmount, [ usdAddress,bnbAddress]).call();
          const amountsOut6 = await ApeSwap.methods.getAmountsOut(bnbAmount, [bnbAddress,usdAddress,]).call();
          const amountsOut7 = await PancakeSwap.methods.getAmountsIn(bnbAmount, [usdAddress,bnbAddress]).call();
          const amountsOut8 = await PancakeSwap.methods.getAmountsOut(bnbAmount, [bnbAddress,usdAddress]).call();

          return {"amountsOut1":amountsOut1,"amountsOut2":amountsOut2,"amountsOut3":amountsOut3,"amountsOut4":amountsOut4,
          "amountsOut5":amountsOut5,"amountsOut6":amountsOut6,"amountsOut7":amountsOut7,"amountsOut8":amountsOut8};
        }
        catch (error) {
          console.error(`Could not get amountsOut`);
        }
      }

      // Calculate Gas
      // Can try web3.estimateGas()   
      const gasPrice = await web3.eth.getGasPrice();


      // LOOP
      pairs = pairsInfo[0];
      pair1 = pairs.pair1;
      pair2 = pairs.pair2;
      console.log(`pairsInfo ${pair1} ${pair2}`);

      // Get Profit
      const promise = getProfits(pairs.amountWei1, pairs.address1, pairs.amountWei2, pairs.address2);
      
      promise.then((data) => {
        console.log(`data ${data.amountsOut1}`);

        const aperesults = {
          buy: data.amountsOut1[0] / 10 ** 18,
          sell: data.amountsOut2[1] / 10 ** 18,
        };
        const aperesults2 = {
          buy: data.amountsOut5[0] / 10 ** 18,
          sell: data.amountsOut6[1] / 10 ** 18,
        };
  
        const pancakeresults = {
          buy: data.amountsOut3[0] / 10 ** 18,
          sell: data.amountsOut4[1] / 10 ** 18,
        };
        const pancakeresults2 = {
          buy: data.amountsOut7[0] / 10 ** 18,
          sell: data.amountsOut8[1] / 10 ** 18,
        };
  
        console.log(`ApeSwap ${pairs.amount1} ${pair1}/${pair2}`);
        console.log(aperesults);
  
        console.log(`PancakeSwap ${pairs.amount1} ${pair1}/${pair2}`);
        console.log(pancakeresults);
  
        console.log(`ApeSwap ${pairs.amount2} ${pair2}/${pair1}`);
        console.log(aperesults2);
  
        console.log(`PancakeSwap ${pairs.amount2} ${pair2}/${pair1}`);
        console.log(pancakeresults2);
  
        // Calculate Payback fee for the exchange. typical 0.003%
        const pancakeBnbPrice =
          (pancakeresults.buy + pancakeresults.sell) / pairs.amount2 / 2;
        const apeswapBnbPrice =
          (aperesults.buy + aperesults.sell) / pairs.amount2 / 2;
  
        let pancakePaybackCalcBusd = pancakeresults.buy / 0.997;
        let apeswapPaybackCalcBusd = aperesults.buy / 0.997;
        let apePaybackCalcWbnb = aperesults2.buy / 0.997;
        let pancakePaybackCalcWbnb = pancakeresults2.buy / 0.997;
  
        let repayBusdPancakeFee =
          pancakePaybackCalcBusd - pancakeresults.buy;
        let repayBusdApeswapFee =
          apeswapPaybackCalcBusd - aperesults.buy;
        let repayWbnbPancakeFee =
          (pancakePaybackCalcWbnb - pancakeresults2.buy) *
          pancakeBnbPrice;
        let repayWbnbApeswapFee =
          (apePaybackCalcWbnb - aperesults2.buy) * apeswapBnbPrice;
  
        const txCost =
          ((330000 * parseInt(gasPrice)) / 10 ** 18) * pancakeBnbPrice;
  
        // Calculate Profit
        const profit1 =
          aperesults.sell - pancakeresults.buy - txCost - repayBusdApeswapFee;
        const profit2 =
          pancakeresults.sell - aperesults.buy - txCost - repayBusdPancakeFee;
        const profit3 =
          pancakeresults2.sell - aperesults2.buy - txCost - repayWbnbPancakeFee;
        const profit4 =
          aperesults2.sell - pancakeresults2.buy - txCost - repayWbnbApeswapFee;
  
        
        console.log(`1 profit1: ${profit1} = aperesults.sell: ${aperesults.sell} pancakeresults.buy: ${pancakeresults.buy} txCost: ${txCost} repayBusdApeswapFee: ${repayBusdApeswapFee} `);
  
        console.log(`profit1: ${profit1} profit2: ${profit2} profit3: ${profit3} profit4: ${profit4} txCost: ${txCost}`);
        const url = initialstateURL
        + `&profit1=${profit1}`
        + `&profit2=${profit2}`
        + `&profit3=${profit3}`
        + `&profit4=${profit4}`
        + `&txCost=${txCost}`
        + `&blockNumber=${block.number}`;
        request.post(url, {}, function(err, res) {
          // console.log(err, res);
        });


        async function executeProfits() {
          try {
            console.log("AAAAAAAAAAAA!");
            console.log(`${addresses.tokens.WBNB}`);
            console.log(`${addresses.tokens.BUSD}`);
            console.log(`${amountInWBNB.toString()}`);

            console.log(`${pairs.address2}`);
            console.log(`${pairs.address1}`);
            console.log(`${pairs.amountWei2.toString()}`);

            if (profit1 > 0 && profit1 > profit2) {
              console.log("Arb opportunity found!");
              console.log(`Flashloan WBNB on Apeswap at ${aperesults.buy} `);
              console.log(`Sell WBNB on PancakeSwap at ${pancakeresults.sell} `);
              console.log(`Expected cost of flashswap: ${repayBusdPancakeFee}`);
              console.log(`Expected Gas cost: ${txCost}`);
              console.log(`Expected profit: ${profit1} BUSD`);
      
              // let tx = flashloan.methods.startArbitrage(
              //   addresses.tokens.WBNB, //token1
              //   addresses.tokens.BUSD, //token2
              //   amountInWBNB.toString(), //amount0
              //   0, //amount1
              //   addresses.apeSwap.factory, //apefactory
              //   addresses.pancakeSwap.router, //pancakerouter
              //   apePaybackCalcWbnb.toString()
              // );
   
              let tx = flashloan.methods.startArbitrage(
                pairs.address2, //token1
                pairs.address1, //token2
                pairs.amountWei2.toString(), //amount0
                0, //amount1
                addresses.apeSwap.factory, //apefactory
                addresses.pancakeSwap.router, //pancakerouter
                apePaybackCalcWbnb.toString()
              );

              const data = tx.encodeABI();
              const txData = {
                from: admin,
                to: flashloan.options.address,
                data,
                gas: "330000",
                gasPrice: gasPrice,
              };
              const receipt = await web3.eth.sendTransaction(txData);
              console.log(`Transaction hash: ${receipt.transactionHash}`);
            }
      
            if (profit2 > 0 && profit2 > profit1) {
              console.log("Arb opportunity found!");
              console.log(`Buy WBNB from PancakeSwap at ${pancakeresults.buy} `);
              console.log(`Sell WBNB from ApeSwap at ${aperesults.sell}`);
              console.log(`Expected cost of flashswap: ${repayBusdApeswapFee}`);
              console.log(`Expected Gas cost: ${txCost}`);
              console.log(`Expected profit: ${profit2} BUSD`);
      
              // let tx = flashloan.methods.startArbitrage(
              //   addresses.tokens.WBNB, //token1
              //   addresses.tokens.BUSD, //token2
              //   amountInWBNB.toString(), //amount0
              //   0, //amount1
              //   addresses.pancakeSwap.factory, //pancakefactory
              //   addresses.apeSwap.router, // aperouter
              //   pancakePaybackCalcWbnb.toString()
              // );
      
              let tx = flashloan.methods.startArbitrage(
                pairs.address2, //token1
                pairs.address1, //token2
                pairs.amountWei2.toString(), //amount0
                0, //amount1
                addresses.pancakeSwap.factory, //pancakefactory
                addresses.apeSwap.router, // aperouter
                pancakePaybackCalcWbnb.toString()
              );
      
              const data = tx.encodeABI();
              const txData = {
                from: admin,
                to: flashloan.options.address,
                data,
                gas: "330000",
                gasPrice: gasPrice,
              };
              const receipt = await web3.eth.sendTransaction(txData);
              console.log(`Transaction hash: ${receipt.transactionHash}`);
            }
      
            if (profit3 > 0 && profit3 > profit4) {
              console.log("Arb opportunity found!");
              console.log(`Flashloan BUSD on Apeswap at ${aperesults2.buy} `);
              console.log(`Sell BUSD on PancakeSwap at ${pancakeresults2.sell} `);
              console.log(`Expected cost of flashswap: ${repayWbnbApeswapFee}`);
              console.log(`Expected Gas cost: ${txCost}`);
              console.log(`Expected profit: ${profit3} WBNB`);
      
              // let tx = flashloan.methods.startArbitrage(
              //   addresses.tokens.BUSD, //token1
              //   addresses.tokens.WBNB, //token2
              //   0, //amount0
              //   amountInBUSD.toString(), //amount1
              //   addresses.apeSwap.factory, //apefactory
              //   addresses.pancakeSwap.router, //pancakerouter
              //   apeswapPaybackCalcBusd.toString()
              // );
 
              let tx = flashloan.methods.startArbitrage(
                pairs.address1, //token1
                pairs.address2, //token2
                0, //amount0
                pairs.amountWei1.toString(), //amount1
                addresses.apeSwap.factory, //apefactory
                addresses.pancakeSwap.router, //pancakerouter
                apeswapPaybackCalcBusd.toString()
              );

              const data = tx.encodeABI();
              const txData = {
                from: admin,
                to: flashloan.options.address,
                data,
                gas: "330000",
                gasPrice: gasPrice,
              };
              const receipt = await web3.eth.sendTransaction(txData);
              console.log(`Transaction hash: ${receipt.transactionHash}`);
            }
      
            if (profit4 > 0 && profit4 > profit3) {
              console.log("Arb opportunity found!");
              console.log(`Flashloan BUSD on PancakeSwap at ${pancakeresults2.buy} `);
              console.log(`Sell BUSD on  at Apeswap ${aperesults2.sell} `);
              console.log(`Expected cost of flashswap: ${repayWbnbPancakeFee}`);
              console.log(`Expected Gas cost: ${txCost}`);
              console.log(`Expected profit: ${profit4} WBNB`);
      
              // let tx = flashloan.methods.startArbitrage(
              //   //token1
              //   addresses.tokens.WBNB,
              //   addresses.tokens.BUSD, //token2
              //   0, //amount0
              //   amountInBUSD.toString(), //amount1
              //   addresses.pancakeSwap.factory, //pancakeFactory
              //   addresses.apeSwap.router, //apeRouter
              //   pancakePaybackCalcBusd.toString()
              // );
      
              let tx = flashloan.methods.startArbitrage(
                //token1
                pairs.address1,
                pairs.address2, //token2
                0, //amount0
                pairs.amountWei1.toString(), //amount1
                addresses.pancakeSwap.factory, //pancakeFactory
                addresses.apeSwap.router, //apeRouter
                pancakePaybackCalcBusd.toString()
              );

              const data = tx.encodeABI();
              const txData = {
                from: admin,
                to: flashloan.options.address,
                data,
                gas: "330000",
                gasPrice: gasPrice,
              };
              const receipt = await web3.eth.sendTransaction(txData);
              console.log(`Transaction hash: ${receipt.transactionHash}`);
            }
          }
          catch (error) {
            console.error(`Could not executeProfits`);
          }
        }


        // Execute Profit
        const promiseExecuteProfits = executeProfits();
        promiseExecuteProfits.then((data) => {
          console.log(``);
        });
      });

    })
    .on("error", (error) => {
      console.log(error);
    });
};
init();
