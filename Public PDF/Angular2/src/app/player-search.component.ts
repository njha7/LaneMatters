import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router'

@Component({
  selector: 'player-search',
  templateUrl: './player-search.component.html',
  styleUrls: ['../vendor/bootstrap/css/bootstrap.css',
    './player-search.component.css']
})

export class PlayerSearchComponent implements OnInit{
    ngOnInit(): void {
        var userRegionCookie = document.cookie.split('=');
        if(userRegionCookie.length > 1) {
            this.region = userRegionCookie[1];
        } else {
            this.region = 'na';
        }
    }

    summonerName: any;
    region: any;
    constructor(
        private router: Router
    ) { }
    search(): void {
        if(document.cookie == null) {
            document.cookie = "userRegion=" + this.region;
        }
        this.router.navigate(['/search', this.region, this.summonerName]);
    }
    @Input() query: String;
}
