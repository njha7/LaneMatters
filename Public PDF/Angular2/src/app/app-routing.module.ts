import { NgModule } from '@angular/core';
import { RouterModule,Routes } from '@angular/router';

import { AboutComponent } from './about.component';
import { PlayerSearchComponent } from './player-search.component';
import { GitHubComponent } from "./github.component";
import { SearchResultsComponent } from './search-results.component';

const routes: Routes = [
    { path: '', component: PlayerSearchComponent },
    { path: 'search/:region/:summonerName', component: SearchResultsComponent},
    { path: 'github', component: GitHubComponent },
    { path: 'about', component: AboutComponent }
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})

export class AppRoutingModule {}