'use strict';

var argv            = require('minimist')(process.argv.slice(2));
var RSVP            = require('rsvp');
var mapSeries       = require('promise-map-series');
var github          = require('octonode');
var parseLinkHeader = require('parse-link-header');

var username = argv.u;
var password = argv.p;
var orgName  = argv.o;

if (!username) {
  throw new Error('You must provide a username as the -u argument');
}

if (!password) {
  throw new Error('You must provide a password as the -p argument');
}

if (!orgName) {
  throw new Error('You must provide a organization name as the -o argument');
}

var client = github.client({
  username: username,
  password: password
});
var ghme = client.me();
var ghorg = client.org(orgName);

getAllWatchedRepos()
  .then(function(repos) {
    console.log(username + ' is currently watching ' + repos.length + ' repos.');
    return repos;
  })
  .then(onlyOrgRepos)
  .then(unwatchAllRepos)
  .then(function(unwatchedRepos) {
    console.log('Unwatched ' + unwatchedRepos.length + ' repos.');
  })
  .catch(function(err) {
    console.log(err.stack);
  });

function unwatchAllRepos(repos) {
  return mapSeries(repos, unwatchRepo);
}

function unwatchRepo(repo) {
  var fullName     = repo.full_name;
  var clientDelete = RSVP.denodeify(client.del.bind(client));

  console.log('Unwatch: ' + fullName);
  return clientDelete('/repos/' + fullName + '/subscription', {}).then(function() {
    return repo;
  });
}

function onlyOrgRepos(repos) {
  return getAllOrgRepos().then(function(orgRepos) {
    var orgRepoFullNames = orgRepos.map(function(orgRepo) {
      return orgRepo.full_name;
    });

    var orgRepoNames = orgRepos.map(function(orgRepo) {
      return orgRepo.name;
    });

    return repos.filter(function(repo) {
      var isOrgRepo       = orgRepoFullNames.indexOf(repo.full_name) > -1;
      var isForkedOrgRepo = repo.fork && orgRepoNames.indexOf(repo.name) > -1;

      return isOrgRepo || isForkedOrgRepo;
    });
  });
}

function getAllOrgRepos() {
  console.log('Finding all ' + orgName + '\'s repos. This may take awhile.');
  return getAll(ghorg.repos.bind(ghorg));
}

function getAllWatchedRepos() {
  console.log('Finding all ' + username + '\'s watched repos. This may take awhile.');
  return getAll(ghme.watched.bind(ghme));
}

function hasNextPage(headers) {
  var link = parseLinkHeader(headers.link);
  return link.next && link.next.page;
}

function getAll(method) {
  var getAllPromise = RSVP.denodeify(getAllCb.bind(null, method));

  return getAllPromise(1, []);
}

function getAllCb(method, page, acc, cb) {
  method(page, 100, function(err, res, headers) {
    if (err) { return cb(err); }

    acc = acc.concat(res);

    var nextPage = hasNextPage(headers);

    if (nextPage) {
      getAllCb(method, nextPage, acc, cb);
    } else {
      cb(null, acc);
    }
  });
}
