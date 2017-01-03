'use strict';

const Provider = require('butter-provider');
const request = require('request');
const sanitize = require('butter-sanitize');

class MovieApi extends Provider {

  constructor(args) {
    super(args);

    if (!(this instanceof MovieApi)) return new MovieApi(args);

    this.apiURL = this.args.apiURL;
    this.lang = this.args.lang;
  }

  _formatDetail(movie) {
    return {
      imdb_id: movie.imdb_id,
      title: movie.title,
      year: movie.year,
      genres: movie.genres,
      rating: parseInt(movie.rating.percentage, 10) / 10,
      poster: movie.images.poster,
      type: Provider.ItemType.MOVIE,
      runtime: movie.runtime,
      backdrop: movie.images.fanart,
      synopsis: movie.synopsis,
      subtitle: {},
      trailer: movie.trailer,
      torrents: movie.torrents['en'] !== null ? movie.torrents['en'] : movie.torrents[Object.keys(movie.torrents)[0]],
      langs: movie.torrents
    };
  }

  _formatFetch(movies) {
  	const results = movies.map(movie => this._formatDetail(movie));

  	return {
  		results: sanitize(results),
  		hasMore: true
  	};
  }

  _processCloudFlareHack(options, url) {
  	const match = url.match(/^cloudflare\+(.*):\/\/(.*)/);
  	if (match) {
  		options = Object.assign(options, {
  			uri: `${match[1]}://cloudflare.com/`,
  			headers: {
  				'Host': match[2],
  				'User-Agent': 'Mozilla/5.0 (Linux) AppleWebkit/534.30 (KHTML, like Gecko) PT/3.8.0'
  			}
  		});
  	}
  	return options;
  }

  _get(index, url, qs) {
    return new Promise((resolve, reject) => {
      const options = {
        url: url,
        json: true,
        qs
      };

      const req = this._processCloudFlareHack(options, this.apiURL[index]);
      return request.get(req, (err, res, data) => {
        if (err || res.statusCode >= 400) {
          if (index + 1 >= this.apiURL.length) {
            return reject(err || new Error('Status Code is above 400'));
          } else {
            return resolve(this._get(index++, url));
          }
        } else if (!data || data.error) {
          err = data ? data.status_message : 'No data returned';
          return reject(new Error(err));
        } else {
          return resolve(data);
        }
      });
    });
  }

  extractId(items) {
  	return items.results.map(item => item[MovieApi.prototype.config.uniqueId]);
  }

  fetch(filters, index = 0) {
  	const params = {};

  	if (filters.keywords) params.keywords = filters.keywords.replace(/\s/g, '% ');
  	if (filters.genre) params.genre = filters.genre;
  	if (filters.order) params.order = filters.order;
  	if (filters.sorter && filters.sorter !== 'popularity') params.sort = filters.sorter;

    filters.page = filters.page ? filters.page : 1;

  	const url = `${this.apiURL[index]}movies/${filters.page}`;
  	return this._get(index, url, params).then(data => this._formatFetch(data));
  }

  detail(torrent_id, old_data, debug, index = 0) {
    if (old_data) return Promise.resolve(old_data);

  	const url = `${this.apiURL[index]}movie/${torrent_id}`;
  	return this._get(index, url).then(data => this._formatDetail(data));
  }

  random(index = 0) {
  	const url = `${this.apiURL[index]}random/movie`;
    return this._get(index, url).then(data => this._formatDetail(data));
  }

  resolveStream(src, filters, data) {
    filters.lang = filters.lang ? filters.lang : this.lang;
  	const qualities = Object.keys(data.torrents);
    filters.quality = filters.quality !== 'none' ? filters.quality : qualities[0];

  	return data.langs[filters.lang][filters.quality];
  }

}

MovieApi.prototype.config = {
	name: 'MovieApi',
	uniqueId: 'imdb_id',
	tabName: 'MovieApi',
  filters: {
    sorters: {
      trending: 'Trending',
      popularity: 'Popularity',
      'last-added': 'Last Added',
      year: 'Year',
      title: 'title',
      rating: 'Rating'
    },
    genres: {
      all: 'All',
      action: 'Action',
      adventure: 'Adventure',
      animation: 'Animation',
      comedy: 'Comedy',
      crime: 'Crime',
      disaster: 'Disaster',
      documentary: 'Documentary',
      drama: 'Drama',
      eastern: 'Eastern',
      family: 'Family',
      'fan-film': 'Fan-Film',
      fantasy: 'Fantasy',
      'film-noir': 'Film-Noir',
      history: 'History',
      holiday: 'Holiday',
      horror: 'Horror',
      indie: 'Indie',
      music: 'Music',
      mystery: 'Mystery',
      none: 'None',
      road: 'Road',
      romance: 'Romance',
      'science-fiction': 'Science-Fiction',
      short: 'Short',
      sports: 'Sports',
      'sporting-event': 'Sporting-Event',
      suspense: 'Suspense',
      thriller: 'Thriller',
      'tv-movie': 'TV-Movie',
      war: 'War',
      western: 'Western'
    }
  },
  defaults: {
    apiURL: [
      'https://movies-v2.api-fetch.website/',
      'cloudflare+https://movies-v2.api-fetch.website/'
    ],
    lang: 'en'
  },
  args: {
    apiURL: Provider.ArgType.ARRAY,
    lang: Provider.ArgType.STRING
	}
};

module.exports = MovieApi;
