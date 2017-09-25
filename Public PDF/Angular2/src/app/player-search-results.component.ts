import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { Location } from '@angular/common';
import { HttpClient } from "@angular/common/http";

@Component({
  selector: 'player-search-result',
  templateUrl: 'player-search-results.component.html',
  styleUrls: [/*'../vendor/bootstrap/css/bootstrap.css',*/ './player-search-results.component.css']
})

export class PlayerSearchResultsComponent implements OnInit{
    ngOnInit(): void {
        // this.player = params['summonerName'];
        // this.region = params['region'];
        var reqString = 'http://localhost/api/players/' + this.region + '/' + this.player;
        console.log(reqString);
        this.http.get(reqString).subscribe(data => {
            console.log(data);
            this.stats = data['data']['match_data'][1];
            this.player = data['data']['match_data'][0];
            this.drawTable();
        });
    }

    constructor(
        private route: ActivatedRoute,
        private http: HttpClient
    ) { }
    tableSelect = 0;
    stats: Object;
    iterableStats: Array<Array<any>>

    // summonerName: String;
    // region: String;
    @Input() player: String; 
    @Input() region: String;

    get selectedTable() {
        return this.tableSelect;
    }

    set selectedTable(value) {
        this.tableSelect = value;
        this.drawTable();
    }

    drawTable(): void {
        console.log(this.tableSelect);
        var iterableStats = [];
        var stats = this.stats[this.tableSelect];
        for(var role in stats){
            for(var champ in stats[role]){
                var champStats = [];
                for(var stat in stats[role][champ]){
                    champStats.push(stats[role][champ][stat]);
                }
                iterableStats.push(champStats);
            }
        }
        this.iterableStats = iterableStats;
    }
}