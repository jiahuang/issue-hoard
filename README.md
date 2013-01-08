#Issue Hoard
Issue tracking from commit diffs. Checkout [www.issuehoard.com](www.issuehoard.com)

Needs the following oauth credientials from Github to run

* public_repo


## local installation

Setup the following configs in your environment

* WEB=supervisor app.js
* SECRET=<super_secret_key>
* GH_KEY=<github_client_id>
* GH_SECRET=<github_secret_key>
* HOST_URL=<www.mysite.com>
* MONGOLAB_URI=<www.mymongodb.com>

```
npm install;
supervisor app.js;
```