const laneAbrv = {
    'TOP': 'TOP',
    'JUNGLE': 'JUNG',
    'MIDDLE': 'MID',
    'MARKSMAN': 'ADC',
    'SUPPORT': 'SUP'
}

//takes a result set from sql and generates a list of jsons that can be used to populate a stats table
class summoner_data_formater {
    constructor(result_set) {
        this.match_data = [result_set[0], this.tally_totals(result_set[1])];
    }

    get_stats() {
        return this.match_data;
    }

    tally_totals(result_set) {
        var total = {};
        var win = {};
        var loss = {};
        var delta = {};
        for(var i = 0; i < result_set.length; i++) {
            if(result_set[i]["win"]) {
                if(win[result_set[i]["lane"]] == null) {
                    win[result_set[i]["lane"]] = {};
                }
                win[result_set[i]["lane"]][result_set[i]["champion"]] = this.calc_stats(result_set[i]);
            } else {
                if(loss[result_set[i]["lane"]] == null) {
                    loss[result_set[i]["lane"]] = {};
                }
                loss[result_set[i]["lane"]][result_set[i]["champion"]] = this.calc_stats(result_set[i]);
            }
            if(total[result_set[i]["lane"]] == null) {
                total[result_set[i]["lane"]] = {};
            }
            if(total[result_set[i]["lane"]][result_set[i]["champion"]] == null) {
                total[result_set[i]["lane"]][result_set[i]["champion"]] = result_set[i];
                for(var j = 0; j < result_set.length; j++) {
                    if(result_set[j]["champion"] == result_set[i]["champion"] && result_set[j]["lane"] == result_set[i]["lane"] && j != i) {
                        if(delta[result_set[i]["lane"]] == null) {
                            delta[result_set[i]["lane"]] = {};
                        }
                        if(result_set[i]["win"]) {
                            // delta[result_set[i]["lane"]][result_set[i]["champion"]][stat] -= result_set[j][stat];
                            delta[result_set[i]["lane"]][result_set[i]["champion"]] = this.add_row(result_set[i], result_set[j], -1);
                            total[result_set[i]["lane"]][result_set[i]["champion"]] = this.add_row(result_set[i], result_set[j], 1);
                        } else {
                            // delta[result_set[i]["lane"]][result_set[i]["champion"]][stat] += -1 * result_set[j][stat];
                            delta[result_set[i]["lane"]][result_set[i]["champion"]] = this.add_row(result_set[j], result_set[i], -1);
                            total[result_set[i]["lane"]][result_set[i]["champion"]] = this.add_row(result_set[j], result_set[i], 1);
                        }
                        delta[result_set[i]["lane"]][result_set[i]["champion"]] = this.calc_stats(delta[result_set[i]["lane"]][result_set[i]["champion"]]);
                        break;
                    }
                }
                total[result_set[i]["lane"]][result_set[i]["champion"]] = this.calc_stats(total[result_set[i]["lane"]][result_set[i]["champion"]]);
            }
        }
        return [total, win, loss, delta];
    }

    stats_shell() {
        var toReturn = {};
        toReturn.champ;
        toReturn.role;
        toReturn.wins;
        toReturn.loss;
        toReturn.leads_closed;
        toReturn.cspm;
        toReturn.gpm;
        toReturn.dpm;
        toReturn.kda;
        toReturn.lp_kda;
        toReturn.deltag;
        toReturn.deltacs;
        toReturn.under_turret_kda;
        toReturn.on_side_kda;
        toReturn.neutral_kda;
        toReturn.off_side_kda;
        toReturn.dive_kda;
        toReturn.leads_lost;
        return toReturn;
    }

    add_row(a, b, type) {
        var row = {};
        for(var stat in a) {
            if(stat != 'champion' && stat != 'lane')  {
                row[stat] = (a[stat] + (type * b[stat]));
            } else {
                row[stat] = a[stat];
            }
        }
        row["games_played"] = a["games_played"] + b["games_played"];
        row["lost"] = b["lost"];
        row["leads_closed"] = a["leads_closed"];
        row["leads_lost"] = b["leads_lost"];
        return row;
    }

    calc_stats(row){
        var calculated_stats = this.stats_shell();
        calculated_stats.champ = row["champion"];
        calculated_stats.role = laneAbrv[row["lane"]];
        calculated_stats.wins = row["won"];
        calculated_stats.loss = row["lost"];
        calculated_stats.leads_closed = row["leads_closed"];
        calculated_stats.cspm = (row["cspm"]/row["games_played"]).toFixed(2);
        calculated_stats.gpm = (row["gpm"]/row["games_played"]).toFixed(2);
        calculated_stats.dpm = (row["dpm"]/row["games_played"]).toFixed(2);
        calculated_stats.kda = row["deaths"] != 0 ? ((row["kills"] + row["assists"])/row["deaths"]).toFixed(2) : row["kills"] + row["assists"];
        calculated_stats.lp_kda = (row["s_death"] + row["g_death"]) != 0 ? 
            ((row["s_kill"] + row["g_kill"] + row["s_assist"] + row["g_assist"])/(row["s_death"] + row["g_death"])).toFixed(2) :
            (row["s_kill"] + row["g_kill"] + row["s_assist"] + row["g_assist"]);
        calculated_stats.deltag = (row["deltag"]/row["games_played"]).toFixed(2);
        calculated_stats.deltacs = (row["deltacs"]/row["games_played"]).toFixed(2);
        calculated_stats.under_turret_kda = row["dive_death"] != 0 ? ((row["fd_kill"] + row["fd_assist"])/row["dive_death"]).toFixed(2) : (row["fd_kill"] + row["fd_assist"]);
        calculated_stats.on_side_kda = row["on_death"] != 0 ? ((row["on_kill"] + row["on_assist"])/row["on_death"]).toFixed(2) : (row["on_kill"] + row["on_assist"]);
        calculated_stats.neutral_kda = row["n_death"] != 0 ? ((row["n_kill"] + row["n_assist"])/row["n_death"]).toFixed(2) :(row["n_kill"] + row["n_assist"]);
        calculated_stats.off_side_kda = row["off_death"] != 0 ? ((row["off_kill"] + row["off_assist"])/row["off_death"]).toFixed(2) : (row["off_kill"] + row["off_assist"]);
        calculated_stats.dive_kda = row["fd_death"] != 0 ? ((row["dive_kill"] + row["dive_assist"])/row["fd_death"]).toFixed(2) : (row["dive_kill"] + row["dive_assist"]);
        calculated_stats.leads_lost = row["leads_lost"];
        return calculated_stats;
    }
}


module.exports = summoner_data_formater;