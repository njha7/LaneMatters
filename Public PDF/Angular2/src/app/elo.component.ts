import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { Location } from '@angular/common';
import { HttpClient } from "@angular/common/http";

@Component({
  selector: 'elo',
  templateUrl: 'elo.component.html',
  styleUrls: ['../vendor/bootstrap/css/bootstrap.css']
})

export class EloComponent implements OnInit{
    @Input() player: String; 
    @Input() region: String;
    assetPath = '../assets/tier-icons/'
    solo: Array<Object>;
    flex: Array<Object>;
    flexAsset = '';
    soloAsset = '';
    edgeCases = {
        'master_i.png':'master.png',
        'challenger_i.png':'challenger.png',
        'unranked_.png':'provisional.png'
    };

    ngOnInit(): void {
        var reqString = 'http://localhost:3000/api/elo/' + this.region + '/' + this.player;
        console.log(reqString);
        this.http.get(reqString).subscribe(data => {
            console.log(data);
            var elo = data['data'];
            elo.forEach(queue => {
                if(queue['queue'] == 420) {
                    this.solo = queue;
                }
                if(queue['queue'] == 440) {
                    this.flex = queue;
                }
            });
            this.flexAsset = this.flex['elo'].toLowerCase() + '_' + this.flex['tier'].toLowerCase() + '.png'
            this.soloAsset = this.solo['elo'].toLowerCase() + '_' + this.solo['tier'].toLowerCase() + '.png'
            this.flexAsset = (this.flexAsset in this.edgeCases) ? this.edgeCases[this.flexAsset] : this.flexAsset;
            this.soloAsset = (this.soloAsset in this.edgeCases) ? this.edgeCases[this.soloAsset] : this.soloAsset;
        });
    }

    constructor(
        private route: ActivatedRoute,
        private http: HttpClient
    ) { }

}