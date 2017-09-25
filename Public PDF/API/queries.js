var KindredAPI = require('kindred-api');
var league_data = require('./league_data');
var summoner_data_formater = require('./summoner_data_formater');
var config = require('./config');

var RiotAPI = new KindredAPI.Kindred(config.Kindred_config);

function playerlookup(req, res, next) {
    var region = req.params.region;
    var summonername = req.params.summonername;
    console.log(summonername);
    league_data.evalPlayer(summonername, region, function(err){
        if(err) {
            console.log(err);
        } else {
            league_data.fetchData(summonername, region, function(error, stats){
                if(error) {
                    console.log(error);
                } else {
                    var data = new summoner_data_formater(stats);
                    // res.setHeader('Access-Control-Allow-Origin')
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.status(200).json({
                        status: 'success',
                        data: data,
                        message: 'summoner stats'
                    });
                }
            });
        }
    });
}

function elo(req, res, next) {
    var region = req.params.region;
    var summonername = req.params.summonername;
    league_data.checkElo(summonername,region, function(err, data){
        if(err){
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.status(500).json({
                status: 'error',
                message: 'an error has occured, please try again'
            });
        } else {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.status(200).json({
                status: 'success',
                data: data,
                message: 'elo'
            });
        }
    });
}

module.exports = {
    playerlookup: playerlookup,
    elo: elo
};
