import 'colors'

import z from 'zero-fill'
import n from 'numbro'
import { rsi, ema } from '@plugins'
import { phenotypes } from '@util'

export default {
  name: 'dema',
  description: 'Buy when (short ema > long ema) and sell when (short ema < long ema).',

  getOptions() {
    this.option('period', 'period length', String, '1h')
    this.option('min_periods', 'min. number of history periods', Number, 21)
    this.option('ema_short_period', 'number of periods for the shorter EMA', Number, 10)
    this.option('ema_long_period', 'number of periods for the longer EMA', Number, 21)
    this.option('up_trend_threshold', 'threshold to trigger a buy signal', Number, 0)
    this.option('down_trend_threshold', 'threshold to trigger a sold signal', Number, 0)
    this.option('overbought_rsi_periods', 'number of periods for overbought RSI', Number, 9)
    this.option('overbought_rsi', 'sold when RSI exceeds this value', Number, 80)
    this.option('noise_level_pct', 'do not trade when short ema is with this % of last short ema', Number, 0)
  },

  calculate(s) {
    if (s.options.overbought_rsi) {
      // sync RSI display with overbought RSI periods
      s.options.rsi_periods = s.options.overbought_rsi_periods
      rsi(s, 'overbought_rsi', s.options.overbought_rsi_periods)
      if (!s.in_preroll && s.period.overbought_rsi >= s.options.overbought_rsi && !s.overbought) {
        s.overbought = true
        if (s.options.mode === 'sim' && s.options.verbose) {
          console.log(('\noverbought at ' + s.period.overbought_rsi + ' RSI, preparing to sold\n').cyan)
        }
      }
    }

    // compture DEMA
    ema(s, 'ema_short', s.options.ema_short_period)
    ema(s, 'ema_long', s.options.ema_long_period)
    if (s.period.ema_short && s.period.ema_long) {
      s.period.dema_histogram = s.period.ema_short - s.period.ema_long
    }
  },

  onPeriod(s, cb) {
    if (!s.in_preroll && typeof s.period.overbought_rsi === 'number') {
      if (s.overbought) {
        s.overbought = false
        s.trend = 'overbought'
        s.signal = 'sold'
        return cb()
      }
    }

    if (typeof s.period.dema_histogram === 'number' && typeof s.lookback[0].dema_histogram === 'number') {
      if (
        s.options.noise_level_pct != 0 &&
        (s.period.ema_short / s.lookback[0].ema_short) * 100 < s.options.noise_level_pct
      ) {
        s.signal = null
      } else if (
        s.period.dema_histogram - s.options.up_trend_threshold > 0 &&
        s.lookback[0].dema_histogram - s.options.up_trend_threshold <= 0
      ) {
        s.signal = 'buy'
      } else if (
        s.period.dema_histogram + s.options.down_trend_threshold < 0 &&
        s.lookback[0].dema_histogram + s.options.down_trend_threshold >= 0
      ) {
        s.signal = 'sell'
      } else {
        s.signal = null // hold
      }
    }
    cb()
  },

  onReport(s) {
    const cols = []
    if (typeof s.period.dema_histogram === 'number') {
      let color = 'grey'
      if (s.period.dema_histogram > 0) {
        color = 'green'
      } else if (s.period.dema_histogram < 0) {
        color = 'red'
      }
      cols.push(z(8, n(s.period.dema_histogram).format('+00.0000'), ' ')[color])
      cols.push(z(8, n(s.period.overbought_rsi).format('00'), ' ').cyan)
    } else {
      cols.push('         ')
    }
    return cols
  },

  phenotypes: {
    // -- common
    period_length: phenotypes.rangePeriod(1, 120, 'm'),
    min_periods: phenotypes.range0(1, 200),
    markdown_buy_pct: phenotypes.rangeFloat(-1, 5),
    markup_sell_pct: phenotypes.rangeFloat(-1, 5),
    order_type: phenotypes.listOption(['maker', 'taker']),
    sell_stop_pct: phenotypes.range1(1, 50),
    buy_stop_pct: phenotypes.range1(1, 50),
    profit_stop_enable_pct: phenotypes.range1(1, 20),
    profit_stop_pct: phenotypes.range0(1, 20),

    // -- strategy
    ema_short_period: phenotypes.range0(1, 20),
    ema_long_period: phenotypes.range0(20, 100),
    up_trend_threshold: phenotypes.range0(0, 50),
    down_trend_threshold: phenotypes.range0(0, 50),
    overbought_rsi_periods: phenotypes.range0(1, 50),
    overbought_rsi: phenotypes.range0(20, 100),
  },
}