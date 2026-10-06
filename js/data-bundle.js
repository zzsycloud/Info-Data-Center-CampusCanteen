window.CC_DATA = {
  "canteens": {
    "meta": {
      "dataset": "食堂基础信息",
      "version": "1.0.0",
      "updated": "2025-01-06",
      "campus": "示范大学 · 主校区",
      "note": "三条食堂楼的基础档案，供首页概览、食堂档案页与三维场景共用。"
    },
    "list": [
      {
        "id": "CT01",
        "name": "第一食堂",
        "shortName": "一食堂",
        "location": "学生宿舍 1 号楼东侧",
        "brand": "大众快餐 · 保障型",
        "floor": 2,
        "seats": 1200,
        "openHours": [
          "06:30-09:00",
          "11:00-13:30",
          "17:00-19:30"
        ],
        "openTime": "06:30",
        "closeTime": "19:30",
        "avgPrice": 11.5,
        "rating": 4.3,
        "stallCount": 12,
        "dishCount": 96,
        "floors": [
          {
            "level": 1,
            "name": "一层 · 大众快餐",
            "stalls": 6
          },
          {
            "level": 2,
            "name": "二层 · 特色小炒",
            "stalls": 6
          }
        ],
        "tags": [
          "离宿舍近",
          "出餐快",
          "性价比高"
        ],
        "position3d": {
          "x": -22,
          "z": 0,
          "width": 15,
          "depth": 11,
          "height": 6
        },
        "color": "#2f7fd6",
        "contact": "饮食服务中心 021-8800-1001",
        "description": "建校最早的食堂，主打两荤一素的称重快餐，一层为大众窗口，二层为现炒窗口，午高峰 11:40-12:20 排队最长。"
      },
      {
        "id": "CT02",
        "name": "第二食堂",
        "shortName": "二食堂",
        "location": "图书馆西侧 200 米",
        "brand": "风味档口 · 特色型",
        "floor": 3,
        "seats": 900,
        "openHours": [
          "06:30-09:30",
          "10:30-14:00",
          "16:30-20:00"
        ],
        "openTime": "06:30",
        "closeTime": "20:00",
        "avgPrice": 16.8,
        "rating": 4.6,
        "stallCount": 16,
        "dishCount": 134,
        "floors": [
          {
            "level": 1,
            "name": "一层 · 面食早点",
            "stalls": 5
          },
          {
            "level": 2,
            "name": "二层 · 地方风味",
            "stalls": 6
          },
          {
            "level": 3,
            "name": "三层 · 轻食水吧",
            "stalls": 5
          }
        ],
        "tags": [
          "品类最全",
          "评分最高",
          "适合聚餐"
        ],
        "position3d": {
          "x": 0,
          "z": 0,
          "width": 19,
          "depth": 13,
          "height": 9
        },
        "color": "#e0762b",
        "contact": "饮食服务中心 021-8800-1002",
        "description": "三层分区经营，一层面食早点、二层地方风味（川湘、江浙、西北）、三层轻食与水吧。菜品更新频率最高，适合同学结伴用餐。"
      },
      {
        "id": "CT03",
        "name": "第三食堂",
        "shortName": "三食堂",
        "location": "体育馆北侧",
        "brand": "清真餐厅 · 智能结算",
        "floor": 1,
        "seats": 600,
        "openHours": [
          "06:30-09:00",
          "11:00-13:30",
          "16:30-19:30"
        ],
        "openTime": "06:30",
        "closeTime": "19:30",
        "avgPrice": 14.2,
        "rating": 4.4,
        "stallCount": 8,
        "dishCount": 62,
        "floors": [
          {
            "level": 1,
            "name": "一层 · 清真餐线与智能结算区",
            "stalls": 8
          }
        ],
        "tags": [
          "清真餐线",
          "自助结算",
          "环境安静"
        ],
        "position3d": {
          "x": 22,
          "z": 0,
          "width": 13,
          "depth": 11,
          "height": 5
        },
        "color": "#3fa36b",
        "contact": "饮食服务中心 021-8800-1003",
        "description": "设有独立清真餐线与智能称重结算台，取餐后放上餐台自动识别菜品并计价，平均结算时间 8 秒，是全校结算最快的食堂。"
      }
    ]
  },
  "dishes": {
    "meta": {
      "dataset": "菜品明细",
      "version": "1.0.0",
      "updated": "2025-01-06",
      "note": "菜品索引，字段包含食堂、档口、类别、价格、热量与评分，供筛选、图表与三维联动使用。",
      "fields": {
        "id": "菜品编号",
        "name": "菜品名称",
        "canteenId": "所属食堂编号",
        "stall": "所属档口",
        "category": "菜品类别",
        "price": "单价（元）",
        "calories": "热量（千卡/份）",
        "protein": "蛋白质（克/份）",
        "rating": "学生评分（5 分制）",
        "monthlySales": "上月销量（份）",
        "spicy": "辣度 0-3",
        "vegetarian": "是否素食",
        "isNew": "是否新品",
        "signature": "是否招牌菜",
        "tags": "标签",
        "supply": "供应时段"
      }
    },
    "list": [
      {
        "id": "D001",
        "name": "红烧肉盖饭",
        "canteenId": "CT01",
        "stall": "大众快餐 A 窗",
        "category": "盖浇饭",
        "price": 13.0,
        "calories": 760,
        "protein": 28.0,
        "rating": 4.6,
        "monthlySales": 3120,
        "spicy": 0,
        "vegetarian": false,
        "isNew": false,
        "signature": true,
        "tags": [
          "招牌",
          "分量足"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D002",
        "name": "宫保鸡丁盖饭",
        "canteenId": "CT01",
        "stall": "大众快餐 A 窗",
        "category": "盖浇饭",
        "price": 12.0,
        "calories": 690,
        "protein": 31.0,
        "rating": 4.5,
        "monthlySales": 2860,
        "spicy": 2,
        "vegetarian": false,
        "isNew": false,
        "signature": true,
        "tags": [
          "下饭",
          "微辣"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D003",
        "name": "番茄炒蛋盖饭",
        "canteenId": "CT01",
        "stall": "大众快餐 A 窗",
        "category": "盖浇饭",
        "price": 9.0,
        "calories": 520,
        "protein": 18.0,
        "rating": 4.2,
        "monthlySales": 2410,
        "spicy": 0,
        "vegetarian": true,
        "isNew": false,
        "signature": false,
        "tags": [
          "素菜",
          "经典"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D004",
        "name": "青椒肉丝盖饭",
        "canteenId": "CT01",
        "stall": "大众快餐 B 窗",
        "category": "盖浇饭",
        "price": 11.0,
        "calories": 610,
        "protein": 26.0,
        "rating": 4.1,
        "monthlySales": 1980,
        "spicy": 1,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "家常"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D005",
        "name": "土豆烧牛肉饭",
        "canteenId": "CT01",
        "stall": "大众快餐 B 窗",
        "category": "盖浇饭",
        "price": 15.0,
        "calories": 720,
        "protein": 33.0,
        "rating": 4.4,
        "monthlySales": 1720,
        "spicy": 0,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "高蛋白"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D006",
        "name": "麻婆豆腐盖饭",
        "canteenId": "CT01",
        "stall": "大众快餐 B 窗",
        "category": "盖浇饭",
        "price": 9.5,
        "calories": 560,
        "protein": 19.0,
        "rating": 4.3,
        "monthlySales": 2050,
        "spicy": 3,
        "vegetarian": true,
        "isNew": false,
        "signature": false,
        "tags": [
          "重辣",
          "素食"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D007",
        "name": "清炒时蔬",
        "canteenId": "CT01",
        "stall": "大众快餐 C 窗",
        "category": "素菜",
        "price": 4.0,
        "calories": 120,
        "protein": 4.0,
        "rating": 4.0,
        "monthlySales": 3450,
        "spicy": 0,
        "vegetarian": true,
        "isNew": false,
        "signature": false,
        "tags": [
          "低热量",
          "素食"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D008",
        "name": "干锅花菜",
        "canteenId": "CT01",
        "stall": "大众快餐 C 窗",
        "category": "素菜",
        "price": 6.0,
        "calories": 210,
        "protein": 5.0,
        "rating": 4.2,
        "monthlySales": 2280,
        "spicy": 2,
        "vegetarian": true,
        "isNew": false,
        "signature": false,
        "tags": [
          "素食"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D009",
        "name": "紫菜蛋花汤",
        "canteenId": "CT01",
        "stall": "大众快餐 C 窗",
        "category": "汤品",
        "price": 2.0,
        "calories": 80,
        "protein": 5.0,
        "rating": 4.1,
        "monthlySales": 4100,
        "spicy": 0,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "免费续汤"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D010",
        "name": "白粥 + 酱菜",
        "canteenId": "CT01",
        "stall": "早餐窗口",
        "category": "早餐",
        "price": 3.5,
        "calories": 260,
        "protein": 7.0,
        "rating": 4.3,
        "monthlySales": 5200,
        "spicy": 0,
        "vegetarian": true,
        "isNew": false,
        "signature": true,
        "tags": [
          "暖胃",
          "早餐"
        ],
        "supply": [
          "早餐"
        ]
      },
      {
        "id": "D011",
        "name": "肉包（2 只）",
        "canteenId": "CT01",
        "stall": "早餐窗口",
        "category": "早餐",
        "price": 3.0,
        "calories": 380,
        "protein": 12.0,
        "rating": 4.4,
        "monthlySales": 6100,
        "spicy": 0,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "早餐",
          "带走方便"
        ],
        "supply": [
          "早餐"
        ]
      },
      {
        "id": "D012",
        "name": "茶叶蛋",
        "canteenId": "CT01",
        "stall": "早餐窗口",
        "category": "早餐",
        "price": 2.0,
        "calories": 90,
        "protein": 7.0,
        "rating": 4.5,
        "monthlySales": 7300,
        "spicy": 0,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "早餐",
          "高蛋白"
        ],
        "supply": [
          "早餐"
        ]
      },
      {
        "id": "D013",
        "name": "兰州牛肉拉面",
        "canteenId": "CT02",
        "stall": "一层 · 面食档",
        "category": "面食",
        "price": 14.0,
        "calories": 620,
        "protein": 30.0,
        "rating": 4.7,
        "monthlySales": 3680,
        "spicy": 1,
        "vegetarian": false,
        "isNew": false,
        "signature": true,
        "tags": [
          "招牌",
          "现拉"
        ],
        "supply": [
          "早餐",
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D014",
        "name": "西红柿鸡蛋面",
        "canteenId": "CT02",
        "stall": "一层 · 面食档",
        "category": "面食",
        "price": 11.0,
        "calories": 560,
        "protein": 20.0,
        "rating": 4.4,
        "monthlySales": 2540,
        "spicy": 0,
        "vegetarian": true,
        "isNew": false,
        "signature": false,
        "tags": [
          "素食"
        ],
        "supply": [
          "早餐",
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D015",
        "name": "重庆小面",
        "canteenId": "CT02",
        "stall": "一层 · 面食档",
        "category": "面食",
        "price": 12.0,
        "calories": 640,
        "protein": 22.0,
        "rating": 4.5,
        "monthlySales": 2790,
        "spicy": 3,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "重辣"
        ],
        "supply": [
          "早餐",
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D016",
        "name": "鲜肉小馄饨",
        "canteenId": "CT02",
        "stall": "一层 · 面食档",
        "category": "面食",
        "price": 9.0,
        "calories": 430,
        "protein": 17.0,
        "rating": 4.3,
        "monthlySales": 2210,
        "spicy": 0,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "清淡",
          "早餐"
        ],
        "supply": [
          "早餐",
          "午餐"
        ]
      },
      {
        "id": "D017",
        "name": "生煎包（4 只）",
        "canteenId": "CT02",
        "stall": "一层 · 面食档",
        "category": "早餐",
        "price": 8.0,
        "calories": 520,
        "protein": 16.0,
        "rating": 4.6,
        "monthlySales": 3300,
        "spicy": 0,
        "vegetarian": false,
        "isNew": true,
        "signature": false,
        "tags": [
          "新品",
          "现煎"
        ],
        "supply": [
          "早餐",
          "午餐"
        ]
      },
      {
        "id": "D018",
        "name": "水煮肉片",
        "canteenId": "CT02",
        "stall": "二层 · 川湘档",
        "category": "川湘菜",
        "price": 18.0,
        "calories": 810,
        "protein": 34.0,
        "rating": 4.5,
        "monthlySales": 1960,
        "spicy": 3,
        "vegetarian": false,
        "isNew": false,
        "signature": true,
        "tags": [
          "重辣",
          "下饭"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D019",
        "name": "剁椒鱼头",
        "canteenId": "CT02",
        "stall": "二层 · 川湘档",
        "category": "川湘菜",
        "price": 26.0,
        "calories": 640,
        "protein": 42.0,
        "rating": 4.6,
        "monthlySales": 880,
        "spicy": 3,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "重辣",
          "高蛋白",
          "适合聚餐"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D020",
        "name": "农家小炒肉",
        "canteenId": "CT02",
        "stall": "二层 · 川湘档",
        "category": "川湘菜",
        "price": 16.0,
        "calories": 700,
        "protein": 29.0,
        "rating": 4.4,
        "monthlySales": 2130,
        "spicy": 2,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "下饭"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D021",
        "name": "东坡肉",
        "canteenId": "CT02",
        "stall": "二层 · 江浙档",
        "category": "江浙菜",
        "price": 17.0,
        "calories": 880,
        "protein": 26.0,
        "rating": 4.5,
        "monthlySales": 1450,
        "spicy": 0,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "甜口",
          "肥而不腻"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D022",
        "name": "龙井虾仁",
        "canteenId": "CT02",
        "stall": "二层 · 江浙档",
        "category": "江浙菜",
        "price": 24.0,
        "calories": 380,
        "protein": 36.0,
        "rating": 4.7,
        "monthlySales": 760,
        "spicy": 0,
        "vegetarian": false,
        "isNew": false,
        "signature": true,
        "tags": [
          "招牌",
          "低热量",
          "高蛋白"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D023",
        "name": "清蒸鲈鱼",
        "canteenId": "CT02",
        "stall": "二层 · 江浙档",
        "category": "江浙菜",
        "price": 22.0,
        "calories": 320,
        "protein": 38.0,
        "rating": 4.6,
        "monthlySales": 920,
        "spicy": 0,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "低热量",
          "高蛋白"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D024",
        "name": "羊肉泡馍",
        "canteenId": "CT02",
        "stall": "二层 · 西北档",
        "category": "西北菜",
        "price": 19.0,
        "calories": 780,
        "protein": 33.0,
        "rating": 4.5,
        "monthlySales": 1180,
        "spicy": 1,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "暖身"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D025",
        "name": "大盘鸡拌面",
        "canteenId": "CT02",
        "stall": "二层 · 西北档",
        "category": "西北菜",
        "price": 28.0,
        "calories": 1080,
        "protein": 44.0,
        "rating": 4.6,
        "monthlySales": 690,
        "spicy": 2,
        "vegetarian": false,
        "isNew": false,
        "signature": true,
        "tags": [
          "适合聚餐",
          "分量足"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D026",
        "name": "鸡胸肉沙拉",
        "canteenId": "CT02",
        "stall": "三层 · 轻食档",
        "category": "轻食",
        "price": 20.0,
        "calories": 320,
        "protein": 35.0,
        "rating": 4.5,
        "monthlySales": 1620,
        "spicy": 0,
        "vegetarian": false,
        "isNew": true,
        "signature": false,
        "tags": [
          "新品",
          "健身餐",
          "低热量"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D027",
        "name": "藜麦蔬菜碗",
        "canteenId": "CT02",
        "stall": "三层 · 轻食档",
        "category": "轻食",
        "price": 18.0,
        "calories": 280,
        "protein": 14.0,
        "rating": 4.3,
        "monthlySales": 1240,
        "spicy": 0,
        "vegetarian": true,
        "isNew": false,
        "signature": false,
        "tags": [
          "素食",
          "低热量"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D028",
        "name": "牛肉全麦卷",
        "canteenId": "CT02",
        "stall": "三层 · 轻食档",
        "category": "轻食",
        "price": 17.0,
        "calories": 420,
        "protein": 28.0,
        "rating": 4.4,
        "monthlySales": 1380,
        "spicy": 1,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "带走方便"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D029",
        "name": "鲜榨橙汁",
        "canteenId": "CT02",
        "stall": "三层 · 水吧",
        "category": "饮品",
        "price": 8.0,
        "calories": 150,
        "protein": 2.0,
        "rating": 4.6,
        "monthlySales": 3080,
        "spicy": 0,
        "vegetarian": true,
        "isNew": false,
        "signature": false,
        "tags": [
          "现榨"
        ],
        "supply": [
          "早餐",
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D030",
        "name": "杨枝甘露",
        "canteenId": "CT02",
        "stall": "三层 · 水吧",
        "category": "饮品",
        "price": 12.0,
        "calories": 260,
        "protein": 3.0,
        "rating": 4.7,
        "monthlySales": 2650,
        "spicy": 0,
        "vegetarian": true,
        "isNew": true,
        "signature": true,
        "tags": [
          "新品",
          "招牌",
          "甜品"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D031",
        "name": "美式咖啡",
        "canteenId": "CT02",
        "stall": "三层 · 水吧",
        "category": "饮品",
        "price": 9.0,
        "calories": 10,
        "protein": 1.0,
        "rating": 4.2,
        "monthlySales": 2460,
        "spicy": 0,
        "vegetarian": true,
        "isNew": false,
        "signature": false,
        "tags": [
          "提神"
        ],
        "supply": [
          "早餐",
          "午餐"
        ]
      },
      {
        "id": "D032",
        "name": "酸辣粉",
        "canteenId": "CT02",
        "stall": "一层 · 风味小吃",
        "category": "风味小吃",
        "price": 8.0,
        "calories": 470,
        "protein": 9.0,
        "rating": 4.4,
        "monthlySales": 3160,
        "spicy": 3,
        "vegetarian": true,
        "isNew": false,
        "signature": false,
        "tags": [
          "重辣",
          "素食"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D033",
        "name": "铁板豆腐",
        "canteenId": "CT02",
        "stall": "一层 · 风味小吃",
        "category": "风味小吃",
        "price": 7.0,
        "calories": 330,
        "protein": 16.0,
        "rating": 4.5,
        "monthlySales": 2870,
        "spicy": 2,
        "vegetarian": true,
        "isNew": false,
        "signature": false,
        "tags": [
          "素食",
          "现做"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D034",
        "name": "手工水饺（12 只）",
        "canteenId": "CT02",
        "stall": "一层 · 风味小吃",
        "category": "风味小吃",
        "price": 13.0,
        "calories": 580,
        "protein": 24.0,
        "rating": 4.6,
        "monthlySales": 2040,
        "spicy": 0,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "现包"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D035",
        "name": "新疆手抓饭",
        "canteenId": "CT03",
        "stall": "清真餐线 A 窗",
        "category": "清真",
        "price": 16.0,
        "calories": 740,
        "protein": 30.0,
        "rating": 4.6,
        "monthlySales": 1780,
        "spicy": 0,
        "vegetarian": false,
        "isNew": false,
        "signature": true,
        "tags": [
          "招牌",
          "清真"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D036",
        "name": "烤羊肉串（5 串）",
        "canteenId": "CT03",
        "stall": "清真餐线 A 窗",
        "category": "清真",
        "price": 15.0,
        "calories": 520,
        "protein": 38.0,
        "rating": 4.7,
        "monthlySales": 2260,
        "spicy": 2,
        "vegetarian": false,
        "isNew": false,
        "signature": true,
        "tags": [
          "招牌",
          "高蛋白",
          "清真"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D037",
        "name": "牛肉拉条子",
        "canteenId": "CT03",
        "stall": "清真餐线 A 窗",
        "category": "清真",
        "price": 15.0,
        "calories": 690,
        "protein": 32.0,
        "rating": 4.5,
        "monthlySales": 1560,
        "spicy": 1,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "清真"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D038",
        "name": "椒麻鸡拌面",
        "canteenId": "CT03",
        "stall": "清真餐线 B 窗",
        "category": "清真",
        "price": 14.0,
        "calories": 660,
        "protein": 29.0,
        "rating": 4.4,
        "monthlySales": 1420,
        "spicy": 2,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "清真",
          "微辣"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D039",
        "name": "番茄牛腩面",
        "canteenId": "CT03",
        "stall": "清真餐线 B 窗",
        "category": "清真",
        "price": 16.0,
        "calories": 640,
        "protein": 34.0,
        "rating": 4.5,
        "monthlySales": 1650,
        "spicy": 0,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "清真",
          "暖胃"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D040",
        "name": "羊肉汤配馕",
        "canteenId": "CT03",
        "stall": "清真餐线 B 窗",
        "category": "清真",
        "price": 13.0,
        "calories": 560,
        "protein": 27.0,
        "rating": 4.3,
        "monthlySales": 1180,
        "spicy": 0,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "清真",
          "暖身"
        ],
        "supply": [
          "早餐",
          "晚餐"
        ]
      },
      {
        "id": "D041",
        "name": "凉拌木耳",
        "canteenId": "CT03",
        "stall": "自助称重区",
        "category": "素菜",
        "price": 5.0,
        "calories": 110,
        "protein": 4.0,
        "rating": 4.4,
        "monthlySales": 1930,
        "spicy": 1,
        "vegetarian": true,
        "isNew": false,
        "signature": false,
        "tags": [
          "素食",
          "低热量"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D042",
        "name": "手撕包菜",
        "canteenId": "CT03",
        "stall": "自助称重区",
        "category": "素菜",
        "price": 5.5,
        "calories": 160,
        "protein": 4.0,
        "rating": 4.2,
        "monthlySales": 1740,
        "spicy": 2,
        "vegetarian": true,
        "isNew": false,
        "signature": false,
        "tags": [
          "素食"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D043",
        "name": "酸奶（原味）",
        "canteenId": "CT03",
        "stall": "自助称重区",
        "category": "饮品",
        "price": 4.5,
        "calories": 130,
        "protein": 6.0,
        "rating": 4.5,
        "monthlySales": 2890,
        "spicy": 0,
        "vegetarian": true,
        "isNew": false,
        "signature": false,
        "tags": [
          "助消化"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D044",
        "name": "牛肉馅饼",
        "canteenId": "CT03",
        "stall": "早餐窗口",
        "category": "早餐",
        "price": 6.0,
        "calories": 390,
        "protein": 15.0,
        "rating": 4.3,
        "monthlySales": 3140,
        "spicy": 0,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "早餐",
          "带走方便"
        ],
        "supply": [
          "早餐"
        ]
      },
      {
        "id": "D045",
        "name": "奶茶（珍珠）",
        "canteenId": "CT03",
        "stall": "早餐窗口",
        "category": "饮品",
        "price": 9.0,
        "calories": 340,
        "protein": 4.0,
        "rating": 4.4,
        "monthlySales": 3560,
        "spicy": 0,
        "vegetarian": true,
        "isNew": true,
        "signature": false,
        "tags": [
          "新品",
          "甜品"
        ],
        "supply": [
          "早餐",
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D046",
        "name": "香菇滑鸡饭",
        "canteenId": "CT01",
        "stall": "二层 · 特色小炒",
        "category": "盖浇饭",
        "price": 14.0,
        "calories": 650,
        "protein": 30.0,
        "rating": 4.5,
        "monthlySales": 1890,
        "spicy": 0,
        "vegetarian": false,
        "isNew": false,
        "signature": false,
        "tags": [
          "蒸菜",
          "清淡"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D047",
        "name": "蒜蓉粉丝蒸娃娃菜",
        "canteenId": "CT01",
        "stall": "二层 · 特色小炒",
        "category": "素菜",
        "price": 8.0,
        "calories": 180,
        "protein": 6.0,
        "rating": 4.4,
        "monthlySales": 1620,
        "spicy": 0,
        "vegetarian": true,
        "isNew": false,
        "signature": false,
        "tags": [
          "素食",
          "低热量"
        ],
        "supply": [
          "午餐",
          "晚餐"
        ]
      },
      {
        "id": "D048",
        "name": "紫米饭团",
        "canteenId": "CT01",
        "stall": "早餐窗口",
        "category": "早餐",
        "price": 5.5,
        "calories": 310,
        "protein": 9.0,
        "rating": 4.2,
        "monthlySales": 2680,
        "spicy": 0,
        "vegetarian": true,
        "isNew": true,
        "signature": false,
        "tags": [
          "新品",
          "早餐",
          "带走方便"
        ],
        "supply": [
          "早餐"
        ]
      }
    ]
  },
  "stats": {
    "meta": {
      "dataset": "食堂客流与满意度月报",
      "version": "1.0.0",
      "updated": "2025-01-06",
      "academicYear": "2024-2025 学年",
      "note": "本项目全部图表数据均以本文件与 dishes.json、nutrition.json 为唯一数据源，页面不做任何硬编码修正。",
      "sampleNote": "客流数据由校门禁闸机与校园卡刷卡记录按小时聚合后抽样 5% 得到；满意度来自 2024 年 11 月线上问卷（有效样本 1 286 份）。",
      "hours": [
        "06:00",
        "07:00",
        "08:00",
        "09:00",
        "10:00",
        "11:00",
        "12:00",
        "13:00",
        "14:00",
        "15:00",
        "16:00",
        "17:00",
        "18:00",
        "19:00",
        "20:00",
        "21:00"
      ],
      "weekdays": [
        "周一",
        "周二",
        "周三",
        "周四",
        "周五",
        "周六",
        "周日"
      ]
    },
    "traffic": {
      "CT01": {
        "holidayIndex": 84,
        "hourly": [
          40,
          260,
          150,
          60,
          120,
          780,
          1560,
          640,
          110,
          70,
          90,
          560,
          980,
          380,
          120,
          45
        ],
        "hourlyWeekend": [
          20,
          130,
          90,
          55,
          140,
          620,
          1180,
          520,
          95,
          65,
          110,
          480,
          760,
          260,
          80,
          30
        ]
      },
      "CT02": {
        "holidayIndex": 100,
        "hourly": [
          35,
          300,
          190,
          80,
          160,
          860,
          1420,
          700,
          150,
          110,
          140,
          690,
          1180,
          470,
          180,
          70
        ],
        "hourlyWeekend": [
          18,
          150,
          120,
          70,
          180,
          700,
          1080,
          560,
          130,
          100,
          160,
          600,
          940,
          340,
          130,
          50
        ]
      },
      "CT03": {
        "holidayIndex": 62,
        "hourly": [
          25,
          210,
          110,
          45,
          90,
          520,
          880,
          420,
          80,
          50,
          70,
          400,
          640,
          240,
          70,
          25
        ],
        "hourlyWeekend": [
          15,
          95,
          60,
          35,
          100,
          430,
          700,
          330,
          65,
          45,
          80,
          340,
          520,
          180,
          55,
          20
        ]
      }
    },
    "waitMinutes": {
      "CT01": [
        0,
        1,
        2,
        2,
        2,
        8,
        14,
        6,
        1,
        0,
        1,
        7,
        11,
        4,
        1,
        0
      ],
      "CT02": [
        0,
        1,
        2,
        3,
        3,
        10,
        17,
        8,
        2,
        1,
        2,
        8,
        13,
        5,
        2,
        1
      ],
      "CT03": [
        0,
        1,
        1,
        1,
        1,
        4,
        7,
        3,
        1,
        0,
        1,
        3,
        5,
        2,
        1,
        0
      ]
    },
    "satisfaction": {
      "dimensions": [
        "菜品口味",
        "价格实惠",
        "出餐速度",
        "环境卫生",
        "服务态度",
        "菜品丰富度"
      ],
      "scaleMax": 5,
      "radar": {
        "CT01": [
          4.25,
          4.62,
          4.35,
          4.1,
          4.05,
          3.85
        ],
        "CT02": [
          4.62,
          4.05,
          4.15,
          4.45,
          4.3,
          4.7
        ],
        "CT03": [
          4.3,
          4.38,
          4.72,
          4.55,
          4.4,
          4.12
        ],
        "全校平均": [
          4.39,
          4.35,
          4.41,
          4.37,
          4.25,
          4.22
        ]
      },
      "scoreDistribution": {
        "labels": [
          "5 分 非常满意",
          "4 分 满意",
          "3 分 一般",
          "2 分 不满意",
          "1 分 非常不满意"
        ],
        "counts": [
          468,
          542,
          196,
          58,
          22
        ]
      },
      "suggestions": [
        {
          "text": "增加低热量、少油少盐的窗口",
          "count": 312
        },
        {
          "text": "午高峰增加备用售饭窗口、缩短排队",
          "count": 286
        },
        {
          "text": "晚餐延长营业时间至 20:30",
          "count": 174
        },
        {
          "text": "及时补充售罄菜品",
          "count": 143
        },
        {
          "text": "增加清真与素食菜品比例",
          "count": 108
        }
      ]
    },
    "weeklyVisits": {
      "labels": [
        "周一",
        "周二",
        "周三",
        "周四",
        "周五",
        "周六",
        "周日"
      ],
      "CT01": [
        3190,
        3250,
        3320,
        3280,
        3010,
        1720,
        1580
      ],
      "CT02": [
        3560,
        3620,
        3710,
        3650,
        3420,
        2140,
        1960
      ],
      "CT03": [
        1960,
        2010,
        2080,
        2040,
        1890,
        1120,
        980
      ]
    },
    "nutrition": {
      "standard": "中国居民膳食指南（2022）午餐建议：热量 600-900 kcal，蛋白质 ≥ 25 g，脂肪 20-35 g，碳水 90-140 g，钠 ≤ 1200 mg。",
      "note": "下列数值为按标准配比折算的单份营养参考值，与实际出餐存在 ±10% 误差。",
      "items": [
        {
          "name": "红烧肉盖饭",
          "calories": 760,
          "protein": 28,
          "fat": 34,
          "carbs": 84,
          "sodium": 1180,
          "fiber": 3.2
        },
        {
          "name": "宫保鸡丁盖饭",
          "calories": 690,
          "protein": 31,
          "fat": 26,
          "carbs": 80,
          "sodium": 1090,
          "fiber": 4.1
        },
        {
          "name": "兰州牛肉拉面",
          "calories": 620,
          "protein": 30,
          "fat": 18,
          "carbs": 88,
          "sodium": 1320,
          "fiber": 3.6
        },
        {
          "name": "水煮肉片",
          "calories": 810,
          "protein": 34,
          "fat": 48,
          "carbs": 52,
          "sodium": 1560,
          "fiber": 5.2
        },
        {
          "name": "鸡胸肉沙拉",
          "calories": 320,
          "protein": 35,
          "fat": 9,
          "carbs": 26,
          "sodium": 620,
          "fiber": 6.8
        },
        {
          "name": "龙井虾仁",
          "calories": 380,
          "protein": 36,
          "fat": 14,
          "carbs": 24,
          "sodium": 880,
          "fiber": 2.4
        },
        {
          "name": "新疆手抓饭",
          "calories": 740,
          "protein": 30,
          "fat": 28,
          "carbs": 92,
          "sodium": 980,
          "fiber": 4.4
        },
        {
          "name": "清蒸鲈鱼",
          "calories": 320,
          "protein": 38,
          "fat": 11,
          "carbs": 12,
          "sodium": 760,
          "fiber": 1.6
        },
        {
          "name": "藜麦蔬菜碗",
          "calories": 280,
          "protein": 14,
          "fat": 7,
          "carbs": 42,
          "sodium": 540,
          "fiber": 7.6
        },
        {
          "name": "大盘鸡拌面",
          "calories": 1080,
          "protein": 44,
          "fat": 42,
          "carbs": 128,
          "sodium": 1680,
          "fiber": 5.8
        }
      ],
      "categoryAverage": [
        {
          "category": "盖浇饭",
          "calories": 668,
          "protein": 25.4,
          "fat": 24.6,
          "carbs": 82
        },
        {
          "category": "面食",
          "calories": 612,
          "protein": 23.8,
          "fat": 18.2,
          "carbs": 86
        },
        {
          "category": "川湘菜",
          "calories": 752,
          "protein": 33.2,
          "fat": 36.4,
          "carbs": 58
        },
        {
          "category": "江浙菜",
          "calories": 528,
          "protein": 33.4,
          "fat": 22.6,
          "carbs": 42
        },
        {
          "category": "西北菜",
          "calories": 824,
          "protein": 36.4,
          "fat": 33.6,
          "carbs": 88
        },
        {
          "category": "轻食",
          "calories": 340,
          "protein": 25.6,
          "fat": 11.6,
          "carbs": 32
        },
        {
          "category": "清真",
          "calories": 668,
          "protein": 31.6,
          "fat": 22.4,
          "carbs": 78
        },
        {
          "category": "素菜",
          "calories": 156,
          "protein": 4.8,
          "fat": 7.2,
          "carbs": 16
        },
        {
          "category": "早餐",
          "calories": 352,
          "protein": 12.2,
          "fat": 11.4,
          "carbs": 52
        },
        {
          "category": "汤品",
          "calories": 80,
          "protein": 5.0,
          "fat": 3.0,
          "carbs": 8
        },
        {
          "category": "饮品",
          "calories": 190,
          "protein": 3.2,
          "fat": 4.6,
          "carbs": 33
        },
        {
          "category": "风味小吃",
          "calories": 458,
          "protein": 16.4,
          "fat": 18.8,
          "carbs": 58
        }
      ]
    },
    "trends": {
      "labels": [
        "1 月",
        "2 月",
        "3 月",
        "4 月",
        "5 月",
        "6 月",
        "7 月",
        "8 月",
        "9 月",
        "10 月",
        "11 月",
        "12 月"
      ],
      "series": [
        {
          "key": "CT01",
          "name": "第一食堂",
          "type": "line",
          "smooth": true,
          "unit": "人次",
          "data": [
            92000,
            51000,
            118000,
            121000,
            124000,
            96000,
            38000,
            42000,
            126000,
            129000,
            125000,
            88000
          ]
        },
        {
          "key": "CT02",
          "name": "第二食堂",
          "type": "line",
          "smooth": true,
          "unit": "人次",
          "data": [
            104000,
            62000,
            132000,
            138000,
            141000,
            108000,
            44000,
            47000,
            142000,
            146000,
            143000,
            101000
          ]
        },
        {
          "key": "CT03",
          "name": "第三食堂",
          "type": "line",
          "smooth": true,
          "unit": "人次",
          "data": [
            58000,
            32000,
            72000,
            74000,
            76000,
            59000,
            24000,
            26000,
            77000,
            79000,
            76000,
            54000
          ]
        },
        {
          "key": "AVG_PRICE",
          "name": "人均消费",
          "type": "bar",
          "unit": "元",
          "data": [
            10.8,
            11.2,
            11.4,
            11.6,
            11.9,
            12.1,
            12.0,
            11.8,
            12.4,
            12.6,
            12.8,
            13.1
          ]
        }
      ],
      "canteenAvgPrice": [
        {
          "key": "CT01",
          "name": "第一食堂",
          "value": 11.5
        },
        {
          "key": "CT02",
          "name": "第二食堂",
          "value": 16.8
        },
        {
          "key": "CT03",
          "name": "第三食堂",
          "value": 14.2
        }
      ],
      "scatterNote": "横轴为菜品单价，纵轴为学生评分（气泡大小表示上月销量），只统计月销 600 份以上的菜品。"
    },
    "derivedRule": {
      "note": "为避免同一指标出现两份互相矛盾的数据，菜品类目分布、价格区间分布、各类别均价、各食堂菜品均价一律由 data/dishes.json 在前端实时折算，不在此文件中重复保存。",
      "functions": [
        "CC.derive.computeCategoryShare",
        "CC.derive.computePriceBins",
        "CC.derive.computePriceStats",
        "CC.derive.computeCanteenAvgPrice"
      ],
      "verifiedBy": "数据校验脚本"
    }
  },
  "notices": {
    "meta": {
      "dataset": "食堂公告与运营动态",
      "version": "1.0.0",
      "note": "首页公告栏与运行提示使用。type 取值：notice 公告 / supply 供应 / price 价格 / event 活动 / warn 提醒。"
    },
    "list": [
      {
        "id": "N001",
        "date": "2025-01-06",
        "canteenId": "CT02",
        "type": "event",
        "level": "info",
        "title": "第二食堂三层水吧「杨枝甘露」新品上线",
        "content": "1 月 6 日起三层水吧新增杨枝甘露，首周 8 折，每日限量 200 杯。"
      },
      {
        "id": "N002",
        "date": "2025-01-05",
        "canteenId": "CT01",
        "type": "warn",
        "level": "warning",
        "title": "第一食堂二层小炒窗口 1 月 8 日设备检修",
        "content": "1 月 8 日 14:00-17:00 二层特色小炒暂停营业，请前往一层大众窗口就餐。"
      },
      {
        "id": "N003",
        "date": "2025-01-04",
        "canteenId": null,
        "type": "supply",
        "level": "info",
        "title": "期末周延长晚餐供应时间",
        "content": "1 月 6 日至 1 月 17 日期末考试周，三个食堂晚餐统一延长至 20:00。"
      },
      {
        "id": "N004",
        "date": "2025-01-03",
        "canteenId": "CT03",
        "type": "notice",
        "level": "info",
        "title": "第三食堂智能结算台新增刷脸支付",
        "content": "结算台已支持校园卡、二维码与刷脸三种方式，首次使用需在自助机绑定。"
      },
      {
        "id": "N005",
        "date": "2025-01-02",
        "canteenId": "CT02",
        "type": "price",
        "level": "info",
        "title": "轻食档口推出 15 元营养套餐",
        "content": "鸡胸肉沙拉 + 鲜榨橙汁组合价 15 元，午晚餐时段供应。"
      },
      {
        "id": "N006",
        "date": "2024-12-30",
        "canteenId": "CT01",
        "type": "notice",
        "level": "info",
        "title": "第一食堂早餐窗口新增紫米饭团",
        "content": "每日 06:30 起供应，售价 5.5 元，售完为止。"
      },
      {
        "id": "N007",
        "date": "2024-12-28",
        "canteenId": null,
        "type": "warn",
        "level": "danger",
        "title": "元旦假期食堂营业时间调整",
        "content": "1 月 1 日仅第二食堂一层正常营业（07:00-19:00），其余食堂休息一天。"
      },
      {
        "id": "N008",
        "date": "2024-12-26",
        "canteenId": "CT03",
        "type": "event",
        "level": "info",
        "title": "第三食堂「清真美食周」",
        "content": "12 月 26 日至 30 日推出抓饭、烤包子、酸奶粽子等 6 款限定菜品。"
      },
      {
        "id": "N009",
        "date": "2024-12-24",
        "canteenId": "CT02",
        "type": "notice",
        "level": "warning",
        "title": "第二食堂二层川湘档辣椒油更换品牌",
        "content": "因供应商调整，辣度略有提升，不能吃辣的同学请提前告知少辣。"
      },
      {
        "id": "N010",
        "date": "2024-12-20",
        "canteenId": null,
        "type": "supply",
        "level": "info",
        "title": "校园卡线上充值功能上线",
        "content": "通过「示范大学后勤」小程序可实时充值，充值后 1 分钟内到账。"
      },
      {
        "id": "N011",
        "date": "2024-12-18",
        "canteenId": "CT01",
        "type": "price",
        "level": "info",
        "title": "第一食堂大众窗口素菜降价 0.5 元",
        "content": "清炒时蔬、蒜蓉粉丝蒸娃娃菜等 4 款素菜统一下调 0.5 元。"
      },
      {
        "id": "N012",
        "date": "2024-12-15",
        "canteenId": "CT02",
        "type": "event",
        "level": "info",
        "title": "「我最喜爱的食堂菜品」投票结束",
        "content": "共 1 286 名同学参与投票，兰州牛肉拉面、红烧肉盖饭、烤羊肉串位列前三。"
      }
    ]
  }
};
