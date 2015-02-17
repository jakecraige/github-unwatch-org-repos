var argv            = require('minimist')(process.argv.slice(2));
var RSVP            = require('rsvp');
var mapSeries       = require('promise-map-series');
var github          = require('octonode');
var parseLinkHeader = require('parse-link-header');

var username = argv.u;
var password = argv.p;
var orgName  = argv.o;

var client = github.client({
  username: username,
  password: password
});
var ghme = client.me();

getAllWatchedRepos()
  .then(onlyOrgRepos)
  .then(unwatchAllRepos)
  .then(function(unwatchedRepos) {
    console.log('Unwatched ' + unwatchedRepos.length + 'repos:');
    console.log(unwatchedRepos);
  })
  .catch(function(err) {
    console.log('Error:');
    console.log(err);
  });

function unwatchAllRepos(repos) {
  return mapSeries(repos, unwatchRepo);
}

function unwatchRepo(repo) {
  var owner  = repo.owner.login;
  var repo   = repo.name;
  var clientDelete = RSVP.denodeify(client.del.bind(client));

  return clientDelete('/repos/' + owner + '/' + repo + '/subscription', {}).then(function() {
    return repo.full_name;
  });
}

function onlyOrgRepos(repos) {
  return repos.filter(function(repo) {
    return repo.owner.login === orgName;
  });
}

function watchedRepos(page, allRepos, cb) {
  ghme.watched(page, 100, function(err, res, headers) {
    if (err) { return cb(err); }

    allRepos = allRepos.concat(res);

    var nextPage = hasNextPage(headers);

    if (nextPage && nextPage < 6) {
      watchedRepos(nextPage, allRepos, cb);
    } else {
      cb(null, allRepos);
    }
  });
}

function getAllWatchedRepos() {
  var watchedReposPromise = RSVP.denodeify(watchedRepos);

  return watchedReposPromise(1, []);
}

function hasNextPage(headers) {
  var link = parseLinkHeader(headers.link);
  return link.next && link.next.page;
}
