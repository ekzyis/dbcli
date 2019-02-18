const argv = require('minimist')(process.argv.slice(2));
const request = require('request');
const fs = require('fs');
const cheerio = require('cheerio');

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

const prefix = (number) => {
  return "" + `${number < 10 ? "0"+number : number}`;
};

const parseToDate = (date) => {
  return "" + prefix(date.getDate()) + prefix(date.getMonth()) + date.getFullYear()
};

const parseToTime = (date) => {
  return "" + prefix(date.getHours()) + prefix(date.getMinutes()) + prefix(date.getSeconds())
};

const DEFAULT_SETTINGS = {
  start: undefined,
  destination: undefined,
  time_is_departure: true,
  date: parseToDate(new Date()),
  time: parseToTime(new Date())
};

const FORMDATA = Object.assign({},DEFAULT_SETTINGS);

Object.keys(argv).forEach(val => {
  if(val === '_') return; // ignore unmatched options
  if(val.match(/(arrival|start|destination|date|time)/)) {
    FORMDATA[val] = argv[val];
    // console.log(`Setting ${val} to ${argv[val]}`);
  }
  else {
    console.log(`invalid option: ${val}`);
  }
});

const { start, destination, time_is_departure, date, time } = FORMDATA;
if(!(start && destination)) console.log("No start and/or destination chosen.") && process.exit(0);

const parseQueryString = (query) => {
  let parsed = {};
  query.split('&').map(v => {
    let key = v.split('=')[0];
    let value = v.split('=')[1];
    parsed = {
      ...parsed,
      [key] : value
    }
  });
  return parsed;
};

const formData = {
  ...parseQueryString(DEFAULT_DATA),
  'REQ0JourneyStopsS0G': start,
  'REQ0JourneyStopsZ0G': destination,
  'REQ0JourneyTime': time,
  'REQ0JourneyDate': date,
  'REQ0HafasSearchForw': `${time_is_departure ? "1" : "0"}`
};

request.post({url: "https://reiseauskunft.bahn.de/bin/query.exe/", form: formData}).pipe(fs.createWriteStream("debug.html"));

request.post({url: "https://reiseauskunft.bahn.de/bin/query.exe/", form: formData}, (err, response, body) => {
  if(err) return console.error(err);
  const $ = cheerio.load(body);
  let arrify = elements => elements.toArray().map(obj => $(obj).text().trim());
  let start_station = arrify($('#resultsOverview').find('tr.firstrow > td.station.first'));
  let dest_station = arrify($('#resultsOverview').find('tr.last > td.station.stationDest'));
  let dep_time = arrify($('#resultsOverview').find('tr.firstrow > td.time'));
  let arr_time = arrify($('#resultsOverview').find('tr.last > td.time'));
  let duration = arrify($('#resultsOverview').find('tr.firstrow > td.duration.lastrow'));
  let product = arrify($('#resultsOverview').find('tr.firstrow > td.products.lastrow'));

  const calculate_padding = (...dataArrays) => {
    const MIN_DISTANCE = 5;
    let pad = [];
    dataArrays.forEach((arr,i) => {
      arr.forEach(entry => {
        if(pad[i] === undefined) pad[i] = entry.length + MIN_DISTANCE ;
        else if(pad[i] < entry.length + MIN_DISTANCE) pad[i] = entry.length + MIN_DISTANCE;
      })
    });
    return pad;
  };

  const pad = calculate_padding(start_station,dest_station,dep_time,arr_time,duration,product);

  for (let i=0;i<start_station.length;++i) {
    console.log(`${start_station[i].padEnd(pad[0])}${dest_station[i].padEnd(pad[1])}${dep_time[i].padEnd(pad[2])}${arr_time[i].padEnd(pad[3])}${duration[i].padEnd(pad[4])}${product[i].padEnd(pad[5])}`)
  }
});

