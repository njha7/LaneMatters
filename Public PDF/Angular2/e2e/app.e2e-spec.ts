import { PleaseDontFeedPage } from './app.po';

describe('please-dont-feed App', () => {
  let page: PleaseDontFeedPage;

  beforeEach(() => {
    page = new PleaseDontFeedPage();
  });

  it('should display welcome message', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('Welcome to app!');
  });
});
