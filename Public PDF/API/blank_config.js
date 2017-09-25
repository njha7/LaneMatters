var KindredAPI = require('kindred-api');
var config = {};

//Postgres
config.db_config = {
    user: 'user',
    password: 'password',
    host: '127.0.0.1',
    port: 5432,
    ssl: true,
    max: 20,
    idleTimeoutMillis: 30000,
    database: 'games'
};

//Google Cloud Platform
config.gcp = {};
config.gcp.projectId = 'project-name-123456';

//Kindred API info
config.Kindred_config = {};
config.Kindred_config.RIOT_API_KEY = 'RGAPI-KEY';
config.Kindred_config.REGIONS = KindredAPI.REGIONS;
config.Kindred_config.LIMITS = KindredAPI.LIMITS;
config.Kindred_config.CACHE_TYPES = KindredAPI.CACHE_TYPES;
config.Kindred_config.QUEUES = KindredAPI.QUEUE_TYPES;
config.Kindred_config.RANKED_STATS = {
    queue: [KindredAPI.QUEUE_TYPES.TEAM_BUILDER_RANKED_SOLO, KindredAPI.QUEUE_TYPES.RANKED_FLEX_SR],
    beginTime: 1481108400000
};

//Game Constants
config.constants = {};
config.constants.anchors = [[2649, 12158], [7400, 7453], [12185, 2767], [7700, 3800], [3800, 7850], [11200, 6800], [7200, 11000]];
config.constants.turretLocations = {
    "top": {"blue":[981, 10441], "red":[4318, 13875]},
    "mid": {"blue":[5846, 6396], "red":[8955, 8510]},
    "bot": {"blue":[10504, 1029], "red":[13866, 4505]}
};
module.exports = config;
