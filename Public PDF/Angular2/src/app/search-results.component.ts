import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { Location } from '@angular/common';

@Component({
  selector: 'search-result',
  templateUrl: 'search-results.component.html',
  styleUrls: ['../vendor/bootstrap/css/bootstrap.css']
})

export class SearchResultsComponent implements OnInit{
    ngOnInit(): void {
        this.route.params.subscribe((params: Params) => {
            this.players = params['summonerName'].toLowerCase();
            this.players = this.players.replace(/ /g, '');
            this.players = this.players.split(',');
            this.region = params['region'];
        });

    }
    constructor(
        private route: ActivatedRoute,
    ) { }
    // summonerName: String;
    // region: String;
    players: any;
    region: String;
}