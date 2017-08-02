'use strict'

const got = require('got')
const Provider = require('butter-provider')
const sanitize = require('butter-sanitize')

const defaultConfig = {
  name: 'MovieApi',
  uniqueId: 'imdb_id',
  tabName: 'MovieApi',
  filters: {
    sorters: {
      trending: 'Trending',
      popularity: 'Popularity',
      released: 'Released',
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
    apiUrl: [
      // 'http://localhost:5000/'
      'https://movies-v2.api-fetch.website/',
      'cloudflare+https://movies-v2.api-fetch.website/'
    ],
    lang: 'en'
  },
  args: {
    apiUrl: Provider.ArgType.ARRAY,
    lang: Provider.ArgType.STRING
  }
}

module.exports = class MovieApi extends Provider {

  constructor(args, config = defaultConfig) {
    super(args, config)

    this.apiUrl = this.args.apiUrl
    this.lang = this.args.lang
  }

  _formatDetail(movie) {
    const torrents = movie.torrents['en'] !== null
      ? movie.torrents['en']
      : movie.torrents[Object.keys(movie.torrents)[0]]

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
      langs: movie.torrents,
      torrents
    }
  }

  _formatFetch(movies) {
    const results = movies.map(movie => this._formatDetail(movie))

    return {
      results: sanitize(results),
      hasMore: true
    }
  }

  _processCloudFlareHack(options, url) {
    const match = url.match(/^cloudflare\+(.*):\/\/(.*)/)

    if (match) {
      const uri = `${match[1]}://cloudflare.com/`
      const opts = Object.assign(options, {
        headers: {
          'Host': match[2],
          'User-Agent': 'Mozilla/5.0 (Linux) AppleWebkit/534.30 (KHTML, like Gecko) PT/3.8.0'
        }
      })

      return {
        opts,
        url: uri
      }
    }

    return {
      opts: options,
      url
    }
  }

  _get(index, url, query) {
    const req = this._processCloudFlareHack({
      query,
      json: true
    }, url)

    return got.get(req.url, req.opts).then(({ body }) => {
      if (!body) {
        return Promise.reject(new Error('No data returned!'))
      }

      return body
    }).catch(err => {
      if (index + 1 >= this.apiUrl.length) {
        return this._get(index++, url, query)
      }

      return err
    })
  }

  extractIds(items) {
    return items.results.map(
      item => item[this.config.uniqueId]
    )
  }

  fetch(filters = {}) {
    const params = {}

    if (filters.keywords) {
      params.keywords = filters.keywords.replace(/\s/g, '% ')
    }
    if (filters.genre) {
      params.genre = filters.genre
    }
    if (filters.order) {
      params.order = filters.order
    }
    if (filters.sorter && filters.sorter !== 'popularity') {
      params.sort = filters.sorter
    }

    const page = filters.page ? filters.page : 1

    const url = `${this.apiUrl}movies/${page}`
    return this._get(0, url, params)
      .then(data => this._formatFetch(data))
  }

  detail(torrentId, oldData) {
    if (oldData) {
      return Promise.resolve(oldData)
    }

    const url = `${this.apiUrl}movie/${torrentId}`
    return this._get(0, url)
      .then(data => this._formatDetail(data))
  }

  random() {
    const url = `${this.apiUrl}random/movie`
    return this._get(0, url)
      .then(data => this._formatDetail(data))
  }

  resolveStream(src, filters, data) {
    const lang = filters.lang ? filters.lang : this.lang

    const qualities = Object.keys(data.torrents)
    const quality = filters.quality !== 'none'
      ? filters.quality
      : qualities[0]

    return data.langs[lang][quality]
  }

}
