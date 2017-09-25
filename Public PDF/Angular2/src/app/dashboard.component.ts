import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router'
import { DashBoardItems } from './dashboard-items';

@Component({
  selector: 'dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['../vendor/bootstrap/css/bootstrap.css']
})
export class DashboardComponent implements OnInit {
    activeLink: String
    navLinks: DashBoardItems[];
    constructor(private router: Router) { }
    ngOnInit(): void {
        this.activeLink = this.router.url;
        this.navLinks = [
            {name: 'Search', path: '/'},
            {name: 'About',  path: '/about'},
            // {name: 'Donate', path: '/donate'}
            // {name: 'GitHub', path: '/github'}
        ];
    }

    onNav(nav): void {
        console.log(nav);
        this.router.navigate([nav]);
    }
}