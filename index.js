#!/usr/bin/node

const argv = require('minimist')(process.argv.slice(2));
const request = require('request');
const fs = require('fs');
const ora = require('ora');
const { prefix, parseToDate, parseToTime, parseQueryString, calculate_padding,
  DBParser
} = require('./util');


const DEFAULT_DATA = "HWAI%3DQUERY%21rit=no&queryPageDisplayed=yes&HWAI%3DQUERY%21displayed=yes&HWAI%3DJS%21ajax=yes&HWAI%3DJS%21js=yes&REQ0JourneyStopsS0A=255" +
  "&ignoreTypeCheck=yes&REQ0JourneyStopsS0a=131072&REQ0JourneyStopsZ0A=255&REQ0JourneyStopsZ0o=8&REQ0JourneyStopsZ0a=131072&REQ1JourneyDate=&REQ1JourneyTime=" +
  "&REQ1HafasSearchForw=1&REQ0JourneyRevia=yes&HWAI%3DQUERY%24via%240%21number=0&REQ0JourneyStops1ID=&REQ0JourneyStops2ID=&HWAI%3DQUERY%24via%241%21number=0" +
  "&REQ1JourneyStops1ID=&REQ1JourneyStops2ID=&HWAI%3DQUERY%21prodAdvanced=0&existOptimizePrice=1&REQ0HafasOptimize1=0%3A1&existProductNahverkehr=1" +
  "&HWAI%3DQUERY%24PRODUCTS%240_0%21show=yes&HWAI%3DQUERY%24PRODUCTS%240_0%21show=yes&advancedProductMode=yes&REQ0JourneyProduct_prod_section_0_0=1" +
  "&REQ0JourneyProduct_prod_section_0_1=1&REQ0JourneyProduct_prod_section_0_2=1&REQ0JourneyProduct_prod_section_0_3=1&REQ0JourneyProduct_prod_section_0_4=1" +
  "&REQ0JourneyProduct_prod_section_0_5=1&REQ0JourneyProduct_prod_section_0_6=1&REQ0JourneyProduct_prod_section_0_7=1&REQ0JourneyProduct_prod_section_0_8=1" +
  "&REQ0JourneyProduct_prod_section_0_9=1&REQ0JourneyProduct_opt_section_0_list=0%3A0000&existProductAutoReturn=yes&REQ0HafasChangeTime=0%3A1&existIntermodalDep_enable=yes" +
  "&REQ0JourneyDep__enable=Foot&existIntermodalDest_enable=yes&REQ0JourneyDest__enable=Foot&HWAI%3DQUERY%21hideExtInt=no&REQ0JourneyDep_Foot_minDist=0" +
  "&REQ0JourneyDest_Foot_minDist=0&REQ0JourneyDep_Foot_maxDist=2000&REQ0JourneyDest_Foot_maxDist=2000&REQ0JourneyDep_Bike_minDist=0&REQ0JourneyDest_Bike_minDist=0&REQ0JourneyDep_Bike_maxDist=5000" +
  "&REQ0JourneyDest_Bike_maxDist=5000&REQ0JourneyDep_KissRide_minDist=2000&REQ0JourneyDest_KissRide_minDist=2000&REQ0JourneyDep_KissRide_maxDist=50000&REQ0JourneyDest_KissRide_maxDist=50000&travelProfile=" +
  "&traveller_Nr=1&REQ0Tariff_TravellerType.1=E&REQ0Tariff_TravellerReductionClass.1=0&REQ0Tariff_TravellerAge.1=&REQ0Tariff_Class=2&existOptionBits=yes&rtMode=12&start=Suchen";

const printUsage = () => {
  let USAGE_PAD = 23;
  console.log(`Usage: db -s START -d DESTINATION [OPTIONS]`);
  console.log(`Search for train connections by making requests to https://reiseauskunft.bahn.de/bin/query.exe/.`);
  console.log(`Example: db -s Mannheim -d München`);
  console.log(`  -s, --start`.padEnd(USAGE_PAD) + `Station where connection should start`);
  console.log(`  -d, --destination`.padEnd(USAGE_PAD) + `Station where connection should end`);
  console.log(`  --time`.padEnd(USAGE_PAD) + `Departure or arrival time of connection. Can be set as arrival time with --arrival. Default time is "departure now".`);
  console.log(`  --date`.padEnd(USAGE_PAD) + `Departure or arrival date of connection. Can be set as arrival date with --arrival. Default date is "departure today".`);
  console.log(`  --arrival`.padEnd(USAGE_PAD) + `Time/date should be interpreted as arrival time`);
  console.log(`  -n`.padEnd(USAGE_PAD) + `Minimum number connections which should be fetched`);
  process.exit(1);
};

const DEFAULT_SETTINGS = {
  start: undefined,
  destination: undefined,
  arrival: false,
  date: parseToDate(new Date()),
  time: parseToTime(new Date()),
  n: 3,
  DEBUG: false
};

const ARGUMENTS = Object.assign({},DEFAULT_SETTINGS);

Object.keys(argv).forEach(val => {
  if(val === '_') return; // ignore unmatched options
  if(val.match(/^(arrival|start|destination|date|time|s|d|n)$/)) {
    let key = val;
    if(val === 's') key = 'start';
    if(val === 'd') key = 'destination';
    ARGUMENTS[key] = argv[val];
    // console.log(`Setting ${val} to ${argv[val]}`);
  }
  else if(val.match(/^debug$/)) {
    ARGUMENTS["DEBUG"] = true;
  }
  else {
    console.log(`invalid option: ${val}`);
    printUsage();
  }
});

const { start, destination, arrival, date, time, n, DEBUG } = ARGUMENTS;

if(!(start && destination)) console.log("No start and/or destination chosen.") || printUsage(); // such fancy code, much wow

const formData = {
  ...parseQueryString(DEFAULT_DATA),
  'REQ0JourneyStopsS0G': start,
  'REQ0JourneyStopsZ0G': destination,
  'REQ0JourneyTime': time,
  'REQ0JourneyDate': date,
  'REQ0HafasSearchForw': `${arrival ? "0" : "1"}`
};

let spinner = ora({ text: 'Fetching connections...', color: 'cyan', indent: 4 }).start();

request.post({url: "https://reiseauskunft.bahn.de/bin/query.exe/", form: formData}, async (err, response, body) => {
  if(err) return console.error(err);
  let fetchcount = 0;
  if(DEBUG) {
    let file = fs.createWriteStream(`response${fetchcount}.html`);
    file.write(body);
    file.end();
    fetchcount++;
  }
  const parser = new DBParser(body);
  let error = parser.checkForErrors();
  if(error) {
    spinner.fail(error);
    process.exit(1);
  }
  let start_station = ['Start'].concat(parser.getStartElements());
  let dest_station = ['Ziel'].concat(parser.getDestinationElements());
  let dep_time = ['Abfahrtszeit'].concat(parser.getDepartureTimeElements());
  let arr_time = ['Ankunftszeit'].concat(parser.getArrivalTimeElements());
  let duration = ['Dauer'].concat(parser.getDurationTimeElements());
  let product = ['Produkt'].concat(parser.getProductElements());

  spinner.text = `Fetching connections... fetched: ${start_station.length-1}`;
  // save previous latest journey time to check for "website blocking"
  let prev_latest = null;
  let TIMEOUT = 1; // timeout if website is blocking (increased
  while(start_station.length-1 < n) {
    // not enough connections found for given time -> make another post request with latest found time + 1 minute
    const latestDepartureTime = dep_time[dep_time.length-1];
    const minute = parseInt(latestDepartureTime.slice(-2));
    const newDepartureTime = latestDepartureTime.slice(0,latestDepartureTime.length-2) + `${minute !== 59 ? `${prefix(minute + 1)}` : "00"}`;
    if(DEBUG) {
      // console.log(`\nlatest journey time is: ${latestJourneyTime}`);
      // console.log(`new journey time is: ${newJourneyTime}`);
    }
    if(prev_latest === latestDepartureTime) {
      // server does not respond with connections => TIMEOUT so server will stop blocking
      spinner.text = `Server blocking requests. Timeout for ${TIMEOUT} seconds...`;
      await new Promise(resolve => {
        setTimeout(() => {
          spinner.text = `Timeout finished.`;
          TIMEOUT *= 2; // increase timeout (maybe server is still blocking)
          TIMEOUT %= 13;  // max timeout is 10000
          resolve()
        }, TIMEOUT*1000);
      })
    }
    // always wait for 250 milliseconds between requests
    await new Promise(resolve => {
      setTimeout(() => {
        resolve()
      }, 250);
    });
    await new Promise((resolve, reject) => {
      // subsequents request times are always handled as departure time since we add 1 minute to latest departure time
      request.post({ url: "https://reiseauskunft.bahn.de/bin/query.exe/", form: {...formData, 'REQ0JourneyTime': newDepartureTime, 'REQ0HafasSearchForw': "1"} }, (err, response, body) => {
        if(err) reject(err);
        if(DEBUG) {
          let file = fs.createWriteStream(`response${fetchcount}.html`);
          file.write(body);
          file.end();
          fetchcount++;
        }
        parser.load(body);
        start_station = start_station.concat(parser.getStartElements());
        dest_station = dest_station.concat(parser.getDestinationElements());
        dep_time = dep_time.concat(parser.getDepartureTimeElements());
        arr_time = arr_time.concat(parser.getArrivalTimeElements());
        duration = duration.concat(parser.getDurationTimeElements());
        product = product.concat(parser.getProductElements());
        spinner.text = `Fetching connections... fetched: ${start_station.length-1}`;
        resolve();
      });
    });
    prev_latest = latestDepartureTime;
  }

  const pad = calculate_padding(start_station,dest_station,dep_time,arr_time,duration,product);

  // NOTE probably a race condition with the spinner
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  for (let i=0;i<start_station.length;++i) {
    console.log(`${start_station[i].padEnd(pad[0])}${dest_station[i].padEnd(pad[1])}${dep_time[i].padEnd(pad[2])}${arr_time[i].padEnd(pad[3])}${duration[i].padEnd(pad[4])}${product[i].padEnd(pad[5])}`)
  }
  spinner.succeed(`Done! Total fetched: ${start_station.length-1}`);
});
