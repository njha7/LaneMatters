import { Component, OnInit } from '@angular/core';
import { environment } from '../environments/environment';

@Component({
  selector: 'github',
  templateUrl: 'github.component.html',
  styleUrls: ['../vendor/bootstrap/css/bootstrap.css']
})

export class GitHubComponent implements OnInit {
    ngOnInit(): void {
        this.repo = this.urlBase + environment.gh;
    }
    urlBase = "https://github.com/";    
    repo: String;
}