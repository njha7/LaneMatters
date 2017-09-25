import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'champion-portrait',
  templateUrl: 'champion-portrait.component.html',
  styleUrls: ['../vendor/bootstrap/css/bootstrap.css', './player-search-results.component.css']
})

export class ChampionPortraitComponent implements OnInit{
    ngOnInit(): void {
        this.uri = this.cid + '.png';
    }

    uri : String;

    @Input() cid: String;
}