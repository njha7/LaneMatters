var config = require('./config');
var postgres = require('pg');
var KindredAPI = require('kindred-api');
var Datastore = require('@google-cloud/datastore');
var projectId = 'tidal-fusion-164115';
var datastore = Datastore({
    projectId:config.gcp.projectId
});


var db_config = config.db_config;
var pgPool = new postgres.Pool(db_config);
var types = require('pg').types;
types.setTypeParser(20, function(val) {
    return parseInt(val)
});

var RiotAPI = new KindredAPI.Kindred(config.Kindred_config);
var turretLocations = config.constants.turretLocations;
var anchors = config.constants.anchors;

var league_data = function() {};

//private helper methods
//////////////////////////////////////////////////////////////
var distance_function = function(x1, x2, y1, y2) {
    return Math.sqrt(Math.pow((x1 - x2),2) + Math.pow((y1 - y2),2));
};

var log_error = function(error) {
    pgPool.query('INSERT INTO error_log(error_time, error_message) VALUES($1, $2)', [new Date().toISOString(), error.message], function(err, res){        
        console.log(error);
    });
};

//dump returned match data into datastore for long term storage
var saveGame = function(matchData, timeLine, region) {
    var gameKey = datastore.key([
        'Region',
        region,
        'Match',
        matchData["gameId"]
    ]);
    var patchRegex = /^\d+\.\d+/;
    var game = [
        {
            name: 'matchData',
            value: matchData,
            excludeFromIndexes: true

        },
        {
            name: 'timeLine',
            value: timeLine,
            excludeFromIndexes: true
        },
        {
            name: 'patch',
            value: matchData["gameVersion"].match(patchRegex)[0]
        },
        {
            name: 'timestamp',
            value: matchData["gameCreation"]
        }
    ];
    var entity = {
        key: gameKey,
        data: game
    };
    datastore.upsert(entity)
    .catch(error => log_error(error));
};

//update stale/non-existant elo
var updateElo = function(sid, region, callback){
    RiotAPI.League.getLeaguePositions({id: sid, region:region}, function(err,res){
        if(err) {
            log_error(err);
            callback(err);
        }
        if(!err){
            try {
                var solo, flex;
                var srank, frank;
                for(var i = 0; i< res.length; i++){
                    if(res[i]["queueType"] == "RANKED_SOLO_5x5") {
                        solo = res[i]["tier"];
                        srank = res[i]["rank"];
                    }
                    if(res[i]["queueType"] == "RANKED_FLEX_SR") {
                        flex = res[i]["tier"];
                        frank = res[i]["rank"];
                    }
                }
                if(flex == null) {
                    flex = "UNRANKED";
                    frank = "";
                }
                if(solo == null) {
                    solo = "UNRANKED";
                    srank = "";
                }
                pgPool.query('insert into elo values($1, $2, $3, $4, $5, $6) on conflict(sid,region, queue) do update set elo = EXCLUDED.elo, tier=EXCLUDED.tier, last_updated=EXCLUDED.last_updated',
                [sid, region, solo, 420, new Date().toISOString(), srank],
                    function(err, res){
                        if(err){
                            log_error(err);
                        }
                        pgPool.query('insert into elo values($1, $2, $3, $4, $5, $6) on conflict(sid,region, queue) do update set elo = EXCLUDED.elo, tier=EXCLUDED.tier, last_updated=EXCLUDED.last_updated',
                        [sid, region, flex, 440, new Date().toISOString(), frank],
                            function(err, res){
                                if(err){
                                    log_error(err);
                                }
                                callback(null);
                        });
                });
            } catch(exception) {
                log_error(exception);
                callback(exception);
            }
        }
    });
};

var queryElo = function(sid, region, callback) {
    pgPool.query("SELECT * FROM elo WHERE sid=$1 and region=$2", [sid, region],
    function(err, elo){
        if(err) {
            log_error(err);
            callback(null, []);
        } else {
            console.log(elo.rows);
            callback(null, elo.rows);
        }
    });
}

//check freshness of elo
league_data.prototype.checkElo = function(sname, region, callback) {
    RiotAPI.Summoner.by.name(sname, region).then(data => {
        var sid = data["id"]; 
        pgPool.query("SELECT * FROM elo WHERE sid=$1 and region=$2", [sid, region],
        function(err, elo){
            if(err) {
                log_error(err);
                callback(err, null);
            } else {
                //no data
                if(elo.rows.length == 0) {
                    console.log("no data");
                    updateElo(sid, region, function(err) {
                        if(err) {
                            callback(err, null);
                        } else {
                            queryElo(sid,region,callback);
                        }
                    });
                } else if(new Date().getTime() - new Date(elo.rows[0].last_updated).getTime() > 21600000) { //stale data
                    console.log("stale data");
                    updateElo(sid, region, function(err) {
                        if(err) {
                            callback(err, null);
                        } else {
                            queryElo(sid,region,callback);
                        }
                    });
                } else { //data can be returned
                    console.log("data found");
                    callback(null, elo.rows);
                }
            }
        });
    });
};

//commit stats from a game
var commitStats = function(statsObject, callback){
    for(player in statsObject["ids"]){
        var row = [];
        for(pid in statsObject["ids"][player]) {
            row.push(statsObject["ids"][player][pid]);
        }
        for(meta in statsObject["metadata"]) {
            row.push(statsObject["metadata"][meta]);
        }
        row.push((player < 6) ? 'BLUE': 'RED');
        for(stat in statsObject["stats"][player]) {
            row.push(statsObject["stats"][player][stat]);
        }
        pgPool.query('INSERT INTO matches VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45) ON CONFLICT DO NOTHING', row, function(err,res) {
            if(err) {
                log_error(err);
                commitError(statsObject["metadata"]["matchId"], statsObject["metadata"]["region"], err);
                callback();
            } else {
                callback();
            }
        });
    }
};

var mapRoles = function(frame) {
    var laners = {
        "TOP" : [],
        "JUNGLE" : [],
        "MIDDLE" : [],
        "BOTTOM" : [],
        "MARKSMAN" : [],
        "SUPPORT" : []
    };
    for(participant in frame) {
        var d = 16000;
        var index = 0;
        for(var point = 0; point < anchors.length; point++){
            var x = frame[participant]["position"]["x"];
            var y = frame[participant]["position"]["y"];
            var dist = Math.sqrt(Math.pow((x - anchors[point][0]),2)
                + Math.pow((y - anchors[point][1]),2));
            if(dist < d){
                d = dist;
                index = point;
            }
        }
        if(index > 2) {//jung
            laners["JUNGLE"].push(participant);
        } else if(index == 2) {//bot
            laners["BOTTOM"].push(participant);
        } else if(index == 1) {//mid
            laners["MIDDLE"].push(participant);
        } else {//top
            laners["TOP"].push(participant);
        }
    }
    return laners;
};

var commitError = function(matchid, region, err) {
    pgPool.query('INSERT INTO error_matches(matchid, region, error) values($1, $2, $3) ON CONFLICT DO NOTHING', [matchid, region, err.message], function(error, result){
        if(error){
            log_error(error);
        }
    });
};

var evalGame = function(id, region, callback) {
    pgPool.query('select matchid from matches where matchid = $1 and region = $2', [id, region], function(err, game){
        if(err) {
            log_error(err);
            callback();
        } else {
            if(game.rows.length == 0) {
                var patchRegex = /^\d+\.\d+/;
                var gameStats = {
                    "ids" : {},
                    "stats" : {},
                    "metadata":{}
                };
                var laners = {
                    "TOP" : [],
                    "JUNGLE" : [],
                    "MIDDLE" : [],
                    "BOTTOM" : [],
                    "MARKSMAN" : [],
                    "SUPPORT" : []
                };
                RiotAPI.Match.by.id(id, region, function(err, matchData) {
                    if(err) {
                        commitError(id, region, err);
                        callback();
                    }
                    if(!err) {
                        if(matchData["gameDuration"] > 300) {
                            var timeline = RiotAPI.Match.Timeline.by.id(id,region, function(err, matchTimeline){
                                    if(err) {
                                        commitError(id, region, err);
                                        callback();
                                    }
                                    if(!err) {
                                        saveGame(matchData, matchTimeline, region);
                                        try {
                                            //gather match metadata
                                            gameStats["metadata"]["matchId"] = matchData["gameId"];
                                            gameStats["metadata"]["region"] = region;
                                            gameStats["metadata"]["queue"] = matchData["queueId"];
                                            gameStats["metadata"]["timestamp"] = matchData["gameCreation"];
                                            gameStats["metadata"]["gameDuration"] = matchData["gameDuration"] / 60;
                                            // gameStats["metadata"]["region"] = matchData["platformId"];
                                            gameStats["metadata"]["patch"] = matchData["gameVersion"].match(patchRegex)[0];
                                            //generate player mappings for later
                                            matchData["participantIdentities"].forEach(function(player){
                                                gameStats["ids"][player["participantId"]] = {};
                                                gameStats["ids"][player["participantId"]]["sname"] = player["player"]["summonerName"];
                                                gameStats["ids"][player["participantId"]]["fname"] =
                                                    player["player"]["summonerName"].toLowerCase().replace(/ /g, "");
                                                gameStats["ids"][player["participantId"]]["aid"] = player["player"]["accountId"];
                                                gameStats["ids"][player["participantId"]]["sid"] = player["player"]["summonerId"];
                                            });
                                            //record endgame stats and prepare stats object for entries from the timeline
                                            matchData["participants"].forEach(function(participant){
                                                gameStats["stats"][participant["participantId"]] = {};
                                                gameStats["stats"][participant["participantId"]]["champion"] = participant["championId"];
                                                gameStats["stats"][participant["participantId"]]["win"] = participant["stats"]["win"];
                                                if(participant["timeline"]["lane"] == null) {
                                                    laners["TOP"].push(participant["participantId"]);
                                                    gameStats["stats"][participant["participantId"]]["lane"] = "TOP";
                                                } else if(participant["timeline"]["lane"] == "MID") {
                                                    laners["TOP"].push(participant["participantId"]);
                                                    gameStats["stats"][participant["participantId"]]["lane"] = "MIDDLE";
                                                } else if(participant["timeline"]["lane"] == "BOT") {
                                                    laners["TOP"].push(participant["participantId"]);
                                                    gameStats["stats"][participant["participantId"]]["lane"] = "BOTTOM";
                                                } else {
                                                    try {
                                                        laners[participant["timeline"]["lane"]].push(participant["participantId"]);
                                                        gameStats["stats"][participant["participantId"]]["lane"] = participant["timeline"]["lane"];
                                                    } catch(exception) {
                                                        laners["TOP"].push(participant["participantId"]);
                                                        gameStats["stats"][participant["participantId"]]["lane"] = "TOP";
                                                    }
                                                }
                                                gameStats["stats"][participant["participantId"]]["kills"] = participant["stats"]["kills"];
                                                gameStats["stats"][participant["participantId"]]["deaths"] = participant["stats"]["deaths"];
                                                gameStats["stats"][participant["participantId"]]["assists"] = participant["stats"]["assists"];
                                                gameStats["stats"][participant["participantId"]]["firstBlood"] =
                                                    (participant["stats"]["firstBloodKill"] || participant["stats"]["firstBloodAssist"]) ? true : false;
                                                gameStats["stats"][participant["participantId"]]["firstTurret"] =
                                                    (participant["stats"]["firstTowerKill"] || participant["stats"]["firstTowerAssist"]) ? true : false;
                                                gameStats["stats"][participant["participantId"]]["gpm"] =
                                                    participant["stats"]["goldEarned"] / gameStats["metadata"]["gameDuration"];
                                                gameStats["stats"][participant["participantId"]]["dpm"] =
                                                    participant["stats"]["totalDamageDealtToChampions"] / gameStats["metadata"]["gameDuration"];
                                                gameStats["stats"][participant["participantId"]]["cspm"] =
                                                    (participant["stats"]["neutralMinionsKilled"] + participant["stats"]["totalMinionsKilled"])
                                                    / gameStats["metadata"]["gameDuration"];
                                                //tentatively record lane assignments, will verify later
                                                //initialize lane phase stats to 0
                                                //delta stats
                                                gameStats["stats"][participant["participantId"]]["deltag"] = 0;
                                                gameStats["stats"][participant["participantId"]]["deltacs"] = 0;
                                                //kill types
                                                gameStats["stats"][participant["participantId"]]["solokills"] = 0;
                                                gameStats["stats"][participant["participantId"]]["gankkills"] = 0;
                                                gameStats["stats"][participant["participantId"]]["onsidekills"] = 0;
                                                gameStats["stats"][participant["participantId"]]["offsidekills"] = 0;
                                                gameStats["stats"][participant["participantId"]]["neutralkills"] = 0;
                                                gameStats["stats"][participant["participantId"]]["divekills"] = 0;
                                                gameStats["stats"][participant["participantId"]]["faildivekills"] = 0;
                                                //death types
                                                gameStats["stats"][participant["participantId"]]["solodeaths"] = 0;
                                                gameStats["stats"][participant["participantId"]]["gankdeaths"] = 0;
                                                gameStats["stats"][participant["participantId"]]["onsidedeaths"] = 0;
                                                gameStats["stats"][participant["participantId"]]["offsidedeaths"] = 0;
                                                gameStats["stats"][participant["participantId"]]["neutraldeaths"] = 0;
                                                gameStats["stats"][participant["participantId"]]["divedeaths"] = 0;
                                                gameStats["stats"][participant["participantId"]]["faildivedeaths"] = 0;
                                                //assist types
                                                gameStats["stats"][participant["participantId"]]["soloassists"] = 0;
                                                gameStats["stats"][participant["participantId"]]["gankassists"] = 0;
                                                gameStats["stats"][participant["participantId"]]["onsideassists"] = 0;
                                                gameStats["stats"][participant["participantId"]]["offsideassists"] = 0;
                                                gameStats["stats"][participant["participantId"]]["neutralassists"] = 0;
                                                gameStats["stats"][participant["participantId"]]["diveassists"] = 0;
                                                gameStats["stats"][participant["participantId"]]["faildiveassists"] = 0;
                                        });
                                        var lane_frame, end_frame;
                                        for(var i = 0; i < matchTimeline["frames"].length; i++){
                                            if(matchTimeline["frames"][i]["timestamp"] < 120000) {
                                                lane_frame = matchTimeline["frames"][i]["participantFrames"];
                                            } else {
                                                break;
                                            }
                                        }
                                        for(role in laners){
                                            if((laners[role].length > 2 && role != "BOTTOM")
                                                || (laners[role].length > 4 && role == "BOTTOM")){
                                                laners = mapRoles(lane_frame);
                                                for(lane in laners) {
                                                    for(var i = 0; i < laners[lane].length; i++) {
                                                        gameStats["stats"][laners[lane][i]]["lane"] = lane;
                                                    }
                                                }
                                                break;
                                            }
                                        }
                                        for(var i = 0; i < matchTimeline["frames"].length; i++){
                                            for(var j = 0; j < matchTimeline["frames"][i]["events"].length; j++){
                                                if(matchTimeline["frames"][i]["events"][j]["type"] == "CHAMPION_KILL"){
                                                    //solokill vs assist
                                                    if(matchTimeline["frames"][i]["events"][j]["killerId"] > 0 && matchTimeline["frames"][i]["events"][j]["killerId"] < 11){
                                                        if(matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"].length == 0){
                                                            gameStats["stats"][matchTimeline["frames"][i]["events"][j]["killerId"]]["solokills"] += 1;
                                                            gameStats["stats"][matchTimeline["frames"][i]["events"][j]["victimId"]]["solodeaths"] += 1;
                                                        //botlane solokill (2v2)
                                                        } else if(matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"].length == 1 &&
                                                            gameStats["stats"][matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"][0]]["lane"] == "BOTTOM" &&
                                                            gameStats["stats"][matchTimeline["frames"][i]["events"][j]["killerId"]]["lane"] == "BOTTOM") {
                                                                gameStats["stats"][matchTimeline["frames"][i]["events"][j]["killerId"]]["solokills"] += 1;
                                                                gameStats["stats"][matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"][0]]["soloassists"] += 1;
                                                                gameStats["stats"][matchTimeline["frames"][i]["events"][j]["victimId"]]["solodeaths"] += 1;
                                                        } else {
                                                            gameStats["stats"][matchTimeline["frames"][i]["events"][j]["killerId"]]["gankkills"] += 1;
                                                            //award assist credit
                                                            for(var k = 0; k < matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"].length; k++) {
                                                                gameStats["stats"][matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"][k]]["gankassists"] += 1;
                                                            }
                                                            gameStats["stats"][matchTimeline["frames"][i]["events"][j]["victimId"]]["gankdeaths"] += 1;
                                                        }
                                                        //positional analysis
                                                        var x = matchTimeline["frames"][i]["events"][j]["position"]["x"];
                                                        var y = matchTimeline["frames"][i]["events"][j]["position"]["y"];
                                                        if((y >= (-1 * x + 14125)) && (y <= (-1 * x + 15625))){ //neutral kill/death
                                                            gameStats["stats"][matchTimeline["frames"][i]["events"][j]["killerId"]]["neutralkills"] += 1;
                                                            gameStats["stats"][matchTimeline["frames"][i]["events"][j]["victimId"]]["neutraldeaths"] += 1;
                                                            for(var k = 0; k < matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"].length; k++) {
                                                                gameStats["stats"][matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"][k]]["neutralassists"] += 1;
                                                            }
                                                        } else if(matchTimeline["frames"][i]["events"][j]["victimId"] < 6) { //blue side
                                                            if(y < (-1 * x + 14125)){ //blue on side
                                                                var topT = distance_function(x, turretLocations["top"]["blue"][0], y, turretLocations["top"]["blue"][1]);
                                                                var midT = distance_function(x, turretLocations["mid"]["blue"][0], y, turretLocations["mid"]["blue"][1]);
                                                                var botT = distance_function(x, turretLocations["bot"]["blue"][0], y, turretLocations["bot"]["blue"][1]);
                                                                if(topT < 775 || midT < 775 || botT < 775) {
                                                                    gameStats["stats"][matchTimeline["frames"][i]["events"][j]["killerId"]]["divekills"] += 1;
                                                                    gameStats["stats"][matchTimeline["frames"][i]["events"][j]["victimId"]]["divedeaths"] += 1;
                                                                    for(var k = 0; k < matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"].length; k++) {
                                                                        gameStats["stats"][matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"][k]]["diveassists"] += 1;
                                                                    }
                                                                } else {
                                                                    gameStats["stats"][matchTimeline["frames"][i]["events"][j]["killerId"]]["offsidekills"] += 1;
                                                                    gameStats["stats"][matchTimeline["frames"][i]["events"][j]["victimId"]]["onsidedeaths"] += 1;
                                                                    for(var k = 0; k < matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"].length; k++) {
                                                                        gameStats["stats"][matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"][k]]["offsideassists"] += 1;
                                                                    }
                                                                }
                                                            } else { //blue side off sides
                                                                var topT = distance_function(x, turretLocations["top"]["red"][0], y, turretLocations["top"]["red"][1]);
                                                                var midT = distance_function(x, turretLocations["mid"]["red"][0], y, turretLocations["mid"]["red"][1]);
                                                                var botT = distance_function(x, turretLocations["bot"]["red"][0], y, turretLocations["bot"]["red"][1]);
                                                                if(topT < 775 || midT < 775 || botT < 775) {
                                                                    gameStats["stats"][matchTimeline["frames"][i]["events"][j]["killerId"]]["faildivekills"] += 1;
                                                                    gameStats["stats"][matchTimeline["frames"][i]["events"][j]["victimId"]]["faildivedeaths"] += 1;
                                                                    for(var k = 0; k < matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"].length; k++) {
                                                                        gameStats["stats"][matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"][k]]["faildiveassists"] += 1;
                                                                    }
                                                                } else {
                                                                    gameStats["stats"][matchTimeline["frames"][i]["events"][j]["killerId"]]["onsidekills"] += 1;
                                                                    gameStats["stats"][matchTimeline["frames"][i]["events"][j]["victimId"]]["offsidedeaths"] += 1;
                                                                    for(var k = 0; k < matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"].length; k++) {
                                                                        gameStats["stats"][matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"][k]]["onsideassists"] += 1;
                                                                    }
                                                                }
                                                            }
                                                        } else { //red side
                                                            if(y > (-1 * x + 15625)){ //red on side
                                                                var topT = distance_function(x, turretLocations["top"]["red"][0], y, turretLocations["top"]["red"][1]);
                                                                var midT = distance_function(x, turretLocations["mid"]["red"][0], y, turretLocations["mid"]["red"][1]);
                                                                var botT = distance_function(x, turretLocations["bot"]["red"][0], y, turretLocations["bot"]["red"][1]);
                                                                if(topT < 775 || midT < 775 || botT < 775) {
                                                                    gameStats["stats"][matchTimeline["frames"][i]["events"][j]["killerId"]]["divekills"] += 1;
                                                                    gameStats["stats"][matchTimeline["frames"][i]["events"][j]["victimId"]]["divedeaths"] += 1;
                                                                    for(var k = 0; k < matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"].length; k++) {
                                                                        gameStats["stats"][matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"][k]]["diveassists"] += 1;
                                                                    }
                                                                } else {
                                                                    gameStats["stats"][matchTimeline["frames"][i]["events"][j]["killerId"]]["offsidekills"] += 1;
                                                                    gameStats["stats"][matchTimeline["frames"][i]["events"][j]["victimId"]]["onsidedeaths"] += 1;
                                                                    for(var k = 0; k < matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"].length; k++) {
                                                                        gameStats["stats"][matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"][k]]["offsideassists"] += 1;
                                                                    }
                                                                }
                                                            } else { //red off side
                                                                var topT = distance_function(x, turretLocations["top"]["blue"][0], y, turretLocations["top"]["blue"][1]);
                                                                var midT = distance_function(x, turretLocations["mid"]["blue"][0], y, turretLocations["mid"]["blue"][1]);
                                                                var botT = distance_function(x, turretLocations["bot"]["blue"][0], y, turretLocations["bot"]["blue"][1]);
                                                                if(topT < 775 || midT < 775 || botT < 775) {
                                                                    gameStats["stats"][matchTimeline["frames"][i]["events"][j]["killerId"]]["faildivekills"] += 1;
                                                                    gameStats["stats"][matchTimeline["frames"][i]["events"][j]["victimId"]]["faildivedeaths"] += 1;
                                                                    for(var k = 0; k < matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"].length; k++) {
                                                                        gameStats["stats"][matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"][k]]["faildiveassists"] += 1;
                                                                    }
                                                                } else {
                                                                    gameStats["stats"][matchTimeline["frames"][i]["events"][j]["killerId"]]["onsidekills"] += 1;
                                                                    gameStats["stats"][matchTimeline["frames"][i]["events"][j]["victimId"]]["offsidedeaths"] += 1;
                                                                    for(var k = 0; k < matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"].length; k++) {
                                                                        gameStats["stats"][matchTimeline["frames"][i]["events"][j]["assistingParticipantIds"][k]]["onsideassists"] += 1;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                                if(matchTimeline["frames"][i]["events"][j]["type"] == "BUILDING_KILL"){
                                                    end_frame = matchTimeline["frames"][i]["participantFrames"];
                                                    break;
                                                }
                                            }
                                        }
                                        //determine adc vs sup
                                        //cs counters
                                        var bcs = -1;
                                        var rcs = -1;
                                        //adc indexes
                                        var badc = 0;
                                        var radc = 0;
                                        for(var bot = 0; bot < laners["BOTTOM"].length; bot++){
                                            if(end_frame[laners["BOTTOM"][bot]]["participantId"] < 6) {
                                                if(end_frame[laners["BOTTOM"][bot]]["minionsKilled"] > bcs) {
                                                    bcs = end_frame[laners["BOTTOM"][bot]]["minionsKilled"];
                                                    badc = bot;
                                                }
                                            } else {
                                                if(end_frame[laners["BOTTOM"][bot]]["minionsKilled"] > rcs) {
                                                    rcs = end_frame[laners["BOTTOM"][bot]]["minionsKilled"];
                                                    radc = bot;
                                                }
                                            }
                                        }
                                        laners["MARKSMAN"].push(laners["BOTTOM"][badc]);
                                        laners["MARKSMAN"].push(laners["BOTTOM"][radc]);
                                        (radc > 0 ) ? radc++ : 0;
                                        (badc > 0 ) ? badc++ : 0;
                                        //use adc indicies to deduce support indices
                                        /*
                                                        4
                                                    3       6
                                                2       5       7
                                            0       2       3       4
                                            [0       1       2       3]
                                        */
                                        var sum = radc + badc;
                                        if(sum % 2 > 0) {
                                            if(sum < 4) {
                                                laners["SUPPORT"].push(laners["BOTTOM"][1]);
                                                laners["SUPPORT"].push(laners["BOTTOM"][3]);
                                            } else {
                                                if(sum - 2 > 4) {
                                                    laners["SUPPORT"].push(laners["BOTTOM"][0]);
                                                    laners["SUPPORT"].push(laners["BOTTOM"][1]);
                                                } else {
                                                    laners["SUPPORT"].push(laners["BOTTOM"][0]);
                                                    laners["SUPPORT"].push(laners["BOTTOM"][3]);
                                                }
                                            }
                                        } else {
                                            if(sum == 4) {
                                                laners["SUPPORT"].push(laners["BOTTOM"][1]);
                                                laners["SUPPORT"].push(laners["BOTTOM"][2]);
                                            } else if(sum > 4) {
                                                laners["SUPPORT"].push(laners["BOTTOM"][0]);
                                                laners["SUPPORT"].push(laners["BOTTOM"][2]);
                                            } else {
                                                laners["SUPPORT"].push(laners["BOTTOM"][2]);
                                                laners["SUPPORT"].push(laners["BOTTOM"][3]);
                                            }
                                        }
                                        delete laners["BOTTOM"];
                                        for(var ad = 0; ad < laners["MARKSMAN"].length; ad++) {
                                            gameStats["stats"][laners["MARKSMAN"][ad]]["lane"] = "MARKSMAN";
                                        }
                                        for(var sup = 0; sup < laners["SUPPORT"].length; sup++) {
                                            gameStats["stats"][laners["SUPPORT"][sup]]["lane"] = "SUPPORT";
                                        }
                                        //calculate deltas
                                        for(lane in laners) {
                                            // console.log(lane);
                                            // console.log(laners[lane]);
                                            // console.log(gameStats["stats"]);
                                            var deltag = end_frame[laners[lane][0]]["totalGold"] - end_frame[laners[lane][1]]["totalGold"];
                                            gameStats["stats"][laners[lane][0]]["deltag"] = deltag;
                                            gameStats["stats"][laners[lane][1]]["deltag"] = -1 * deltag;
                                            var deltacs = (end_frame[laners[lane][0]]["minionsKilled"] + end_frame[laners[lane][0]]["jungleMinionsKilled"])
                                                - (end_frame[laners[lane][1]]["minionsKilled"] + end_frame[laners[lane][1]]["jungleMinionsKilled"]);
                                            gameStats["stats"][laners[lane][0]]["deltacs"] = deltacs;
                                            gameStats["stats"][laners[lane][1]]["deltacs"] = -1 * deltacs;
                                        }
                                        //commit to sql
                                        commitStats(gameStats, callback);
                                    } catch(exception){
                                        commitError(id, region, exception);
                                        log_error(exception);
                                        callback();
                                    } finally {
                                        // callback();
                                    }
                                }
                            });
                        } else {
                            callback();
                        }
                    }
                });
            } else {
                callback();
            }
        }
    });
};

//////////////////////////////////////////////////////////////
league_data.prototype.evalPlayer = function(summonerName, region, callback){
    var sid, aid;
    var games = 0;
    RiotAPI.Summoner.by.name(summonerName, region, function(err, data){
            if(err) {
                log_error(err);
                callback(err);
            } else {
                sid = data["id"];
                aid = data["accountId"];
                rev_date = data["revisionDate"];
                pgPool.query('SELECT eval_date, total_games FROM completed_evals where sid = $1 and region = $2', [sid, region]).then(result => {
                    if(result.rows.length == 0) { //new players
                        RiotAPI.Matchlist.by.account(aid, config.Kindred_config.RANKED_STATS, region)
                        .then(data => {
                            games = data["matches"].length;
                            var j = 0;
                            for(var i = 0; i < data["matches"].length; i++) {
                                evalGame(data["matches"][i].gameId, region, function(){
                                    if(++j === games)  {
                                        callback();
                                    }
                                });
                            }
                        })
                        .then(() => {
                            pgPool.query('INSERT INTO completed_evals VALUES($1, $2, $3, $4, $5) ON CONFLICT(sid, region) DO UPDATE SET eval_date = EXCLUDED.eval_date, total_games = completed_evals.total_games + excluded.total_games, fsname = EXCLUDED.fsname',
                            [summonerName, sid, region, rev_date, games], function(err, res){
                                if(err) {
                                    log_error(err);
                                }
                            });
                        })
                        .catch(error => log_error(error));
                    } else { //data exists
                        if(rev_date > result.rows[0]["eval_date"]) { //data is stale
                            var alt_config = {
                                queue: [config.Kindred_config.QUEUES.TEAM_BUILDER_RANKED_SOLO, config.Kindred_config.QUEUES.RANKED_FLEX_SR],
                                beginTime: result.rows[0]["eval_date"]
                            };
                            RiotAPI.Matchlist.by.account(aid, alt_config, region)
                            .then(data => {
                                games = data["matches"].length;
                                var j = 0;
                                for(var i = 0; i < data["matches"].length; i++) {
                                    evalGame(data["matches"][i].gameId, region, function(){
                                        if(++j === games)  {
                                            callback();
                                        }
                                    });
                                }
                            })
                            .then(() => {
                                pgPool.query('INSERT INTO completed_evals VALUES($1, $2, $3, $4, $5) ON CONFLICT(sid, region) DO UPDATE SET eval_date = EXCLUDED.eval_date, total_games = completed_evals.total_games + excluded.total_games, fsname = EXCLUDED.fsname',
                                [summonerName, sid, region, rev_date, games], function(err, res){
                                    if(err) {
                                        log_error(err);
                                    }
                                });
                            })
                            .catch(callback());
                        } else { //data is fresh
                            callback();
                        }
                    }
                }).catch(error => log_error(error));
            }
    });
};

league_data.prototype.fetchData = function(summonerName, region, callback){
    RiotAPI.Summoner.by.name(summonerName, region, function(err, data){
        if(err) {
            log_error(err);
            callback(err, null);
        } else {
            pgPool.query("select champion, lane, win,count(champion)as games_played, sum(case when win = true then 1 else 0 End) as won, sum(case when win = false then 1 else 0 End) as lost,sum(kills) as kills, sum(deaths) as deaths, sum(assists) as assists,sum(Case When win = true and deltag > 0 Then 1 Else 0 End) as leads_closed,sum(Case When win = false and deltag > 0 Then 1 Else 0 End) as leads_lost,sum(cspm) as cspm, sum(gpm) as gpm, sum(deltag) as deltag, sum(deltacs) as deltacs,sum(dpm) as dpm,sum(s_kill) as s_kill, sum(g_kill) as g_kill, sum(on_kill) as on_kill,sum(off_kill) as off_kill, sum(n_kill) as n_kill, sum(dive_kill) as dive_kill,sum(fd_kill) as fd_kill, sum(s_death) as s_death, sum(g_death) as g_death, sum(on_death) as on_death, sum(off_death) as off_death, sum(n_death) as n_death, sum(dive_death) as dive_death, sum(fd_death) as fd_death, sum(s_assist) as s_assist, sum(g_assist) as g_assist, sum(on_assist) as on_assist, sum(off_assist) as off_assist, sum(n_assist) as n_assist, sum(dive_assist) as dive_assist, sum(fd_assist) as fd_assist from matches where sid= $1 and region = $2 group by champion, lane, win order by champion asc", [data["id"], region], function(err, res) {
                if(err) {
                    log_error(err);
                    callback(err, null);
                } else {
                    callback(null, [data['name'],res.rows]);
                }
            });
        }
    });
    
};
    
module.exports = new league_data();