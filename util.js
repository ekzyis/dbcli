const cheerio = require('cheerio');

const prefix = (number) => {
  return "" + `${number < 10 ? "0"+number : number}`;
};

const parseToDate = (date) => {
  return "" + prefix(date.getDate()) + prefix(date.getMonth()+1) + date.getFullYear()
};

const parseToTime = (date) => {
  return "" + prefix(date.getHours()) + prefix(date.getMinutes())
};

const parseQueryString = (query) => {
  let parsed = {};
  query.split('&').forEach(v => {
    let key = v.split('=')[0];
    let value = v.split('=')[1];
    parsed = {
      ...parsed,
      [key] : value
    }
  });
  return parsed;
};

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

function DBParser(body) {
  this.$ = cheerio.load(body);
}
DBParser.prototype.load = function(body) {
  this.$ = cheerio.load(body);
};
DBParser.prototype.arrify = function(elements) {
  return elements.toArray().map(obj => this.$(obj).text().trim());
};
DBParser.prototype.getStartElements = function() {
  return this.arrify(this.$('#resultsOverview').find('tr.firstrow > td.station.first'))
};
DBParser.prototype.getDestinationElements = function() {
  return this.arrify(this.$('#resultsOverview').find('tr.last > td.station.stationDest'))
};
DBParser.prototype.getDepartureTimeElements = function() {
  return this.arrify(this.$('#resultsOverview').find('tr.firstrow > td.time'))
};
DBParser.prototype.getArrivalTimeElements = function() {
  return this.arrify(this.$('#resultsOverview').find('tr.last > td.time'))
};
DBParser.prototype.getDurationTimeElements = function() {
  return this.arrify(this.$('#resultsOverview').find('tr.firstrow > td.duration.lastrow'))
};
DBParser.prototype.getProductElements = function() {
  return this.arrify(this.$('#resultsOverview').find('tr.firstrow > td.products.lastrow'))
};

module.exports = {
  prefix,
  parseToDate,
  parseToTime,
  parseQueryString,
  calculate_padding,
  DBParser
};
