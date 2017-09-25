import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule }   from '@angular/forms';
import { RouterModule }   from '@angular/router';
import { HttpClientModule } from '@angular/common/http';


import { AboutComponent } from './about.component';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { ChampionPortraitComponent } from './champion-portrait.component';
import { DashboardComponent } from './dashboard.component';
import { EloComponent } from './elo.component';
import { SearchResultsComponent } from './search-results.component';
import { PlayerSearchComponent } from './player-search.component';
import { PlayerSearchResultsComponent } from './player-search-results.component';
import { GitHubComponent } from './github.component';




@NgModule({
  declarations: [
    AboutComponent,
    AppComponent,
    ChampionPortraitComponent,
    DashboardComponent,
    EloComponent,
    SearchResultsComponent,
    PlayerSearchComponent,
    PlayerSearchResultsComponent,
    GitHubComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule,
    HttpClientModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
